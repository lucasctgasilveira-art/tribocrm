/**
 * Service Worker da extensão TriboCRM.
 *
 * RESPONSABILIDADES
 *   1. Escutar mensagens dos content scripts / popup e rotear para os handlers
 *   2. Inicializar o scheduler de mensagens agendadas
 *   3. Reagir a alarms `task:${id}` e disparar notificações locais
 *   4. Reagir a eventos do ciclo de vida da extensão (instalação, atualização)
 *
 * LIMITAÇÕES CRÍTICAS DE V3
 *   - Este worker DORME após ~30s sem eventos. Nada de estado em variáveis globais.
 *   - Qualquer dado que precise persistir vai pro chrome.storage.
 *   - Todos os handlers são assíncronos. Se retornar Promise, é preciso retornar `true`
 *     no onMessage para manter o canal aberto até a Promise resolver.
 *
 * NOTIFICAÇÕES DE TAREFA — limitações aceitas:
 *   - Só disparam com o Chrome aberto (SW acorda via alarm; se Chrome fechado, nada).
 *   - 1 disparo por task (flag `notified` no storage, CAS em markNotifiedIfPending).
 *   - Permissão 'notifications' já está no manifest, mas o usuário pode ter
 *     desativado em chrome://settings/content/notifications — checamos
 *     getPermissionLevel e abortamos silenciosamente se 'denied'.
 *   - TODO: adicionar chrome.notifications.onClicked pra abrir WhatsApp Web no lead.
 */

import { handlers } from './handlers';
import {
  initScheduler,
  readPrepData,
  clearPrepData,
  clearTaskNotifiedFlag,
  PREP_NOTIFICATION_PREFIX
} from './scheduler';
import { api } from '@shared/api';
import { createResponder } from '@shared/utils/messaging';
import { createLogger } from '@shared/utils/logger';
import type { ExtensionMessage } from '@shared/types/messages';

const log = createLogger('service-worker');

const TASK_ALARM_PREFIX = 'task:';
const CONFIRM_NOTIFICATION_PREFIX = 'whatsapp-confirm:';

// ── Instalação / atualização ─────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  log.info('Extensão instalada/atualizada', details.reason);

  if (details.reason === 'install') {
    // Abre página de boas-vindas (opcional, podemos implementar depois)
    // chrome.tabs.create({ url: 'https://app.tribocrm.com.br/extensao/boas-vindas' });
  }
});

chrome.runtime.onStartup.addListener(() => {
  log.info('Chrome iniciou — service worker acordou');
});

// ── Roteador principal de mensagens ──────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  const respond = createResponder(sendResponse);

  // Lookup do handler pelo tipo
  const handler = handlers[message.type];
  if (!handler) {
    log.warn('Mensagem sem handler', message.type);
    respond.fail(`Nenhum handler para ${message.type}`);
    return false;
  }

  // Executa de forma assíncrona. Retornamos `true` para indicar que a resposta
  // virá de forma assíncrona — isso mantém a porta aberta.
  (async () => {
    try {
      // @ts-expect-error — mapping dinâmico entre message.type e seu payload
      const result = await handler(message.payload);
      respond.ok(result);
    } catch (err) {
      log.error('Erro no handler', message.type, err);
      respond.fail(err);
    }
  })();

  return true; // mantém o canal aberto
});

// ── Mensagens externas (CRM web app) ─────────────────────────────
//
// O frontend de https://app.tribocrm.com.br/* (declarado em
// externally_connectable no manifest) envia phone+leadId quando o
// vendedor clica num botao de WhatsApp. Guardamos em chrome.storage
// pra que o content script do WhatsApp Web leia no boot e identifique
// o lead automaticamente — sem depender de URL/hash.
//
// Storage shape: { 'crm-phone-hint': { phone, leadId, ts } }
// TTL implicito de 5 min — leituras antigas sao ignoradas pra evitar
// vazar hint pra conversas nao relacionadas se o vendedor demorar.

const CRM_HINT_KEY = 'crm-phone-hint';

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  log.info('Mensagem externa recebida', { type: message?.type, origin: sender.origin });

  if (!message || message.type !== 'CRM_PHONE_HINT') {
    sendResponse({ ok: false, error: 'Tipo de mensagem desconhecido' });
    return false;
  }

  const phone = String(message.phone ?? '').replace(/\D/g, '');
  const leadId = message.leadId ? String(message.leadId) : null;

  if (!phone) {
    sendResponse({ ok: false, error: 'phone obrigatorio' });
    return false;
  }

  chrome.storage.local.set(
    { [CRM_HINT_KEY]: { phone, leadId, ts: Date.now() } },
    () => {
      const err = chrome.runtime.lastError;
      if (err) {
        log.error('Falha ao gravar hint do CRM', err);
        sendResponse({ ok: false, error: err.message });
      } else {
        log.info('Hint do CRM gravado', { phone, leadId });
        sendResponse({ ok: true });
      }
    }
  );
  return true; // mantem porta aberta pro callback async
});

// ── Alarms de tarefa → notificações locais ───────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(TASK_ALARM_PREFIX)) return;
  const taskId = alarm.name.slice(TASK_ALARM_PREFIX.length);

  try {
    // Re-read + CAS atômico dentro do service — só marca notified=true
    // se a task ainda está pending e !notified. Se marcada como done
    // entre agendar e disparar, abortamos sem notificar.
    const task = await api.tasks.markNotifiedIfPending(taskId);
    if (!task) {
      log.debug('Alarm disparou mas task não está mais elegível', taskId);
      return;
    }

    const permission = await new Promise<string>((resolve) =>
      chrome.notifications.getPermissionLevel((level) => resolve(level))
    );
    if (permission !== 'granted') {
      log.warn('Notificações desativadas — pulando', taskId);
      return;
    }

    const typeLabelMap: Record<string, string> = {
      call: 'Ligação',
      visit: 'Visita',
      meeting: 'Reunião',
      email: 'E-mail',
      other: 'Tarefa'
    };
    const typeLabel = typeLabelMap[task.type] ?? 'Tarefa';

    await new Promise<string>((resolve) => {
      chrome.notifications.create(
        `${TASK_ALARM_PREFIX}${task.id}`,
        {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
          title: `Tarefa vencendo: ${task.title}`,
          message: `Lead: ${task.leadName} · ${typeLabel}`,
          priority: 2
        },
        (notificationId) => resolve(notificationId)
      );
    });

    log.info('Notificação disparada', taskId);
  } catch (err) {
    log.error('Falha ao processar alarm de tarefa', taskId, err);
  }
});

// ── Notificações de tarefa WhatsApp (Fase 2 - Opção C) ───────────
//
// Fluxo de cliques:
//   whatsapp-prep:{taskId}
//     botão 0 (Abrir e preparar) → navega aba WA, manda MESSAGE_SEND_NOW
//     botão 1 (Adiar 30 min)     → snooze + reset flag de notified
//
//   whatsapp-confirm:{taskId}
//     botão 0 (Enviei)     → POST /tasks/:id/whatsapp-sent
//     botão 1 (Não enviou) → POST /tasks/:id/whatsapp-failed

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  log.info('Botão de notificação clicado', { notificationId, buttonIndex });

  if (notificationId.startsWith(PREP_NOTIFICATION_PREFIX)) {
    const taskId = notificationId.slice(PREP_NOTIFICATION_PREFIX.length);
    chrome.notifications.clear(notificationId);

    if (buttonIndex === 0) {
      await handlePrepOpen(taskId);
    } else if (buttonIndex === 1) {
      await handlePrepSnooze(taskId);
    }
    return;
  }

  if (notificationId.startsWith(CONFIRM_NOTIFICATION_PREFIX)) {
    const taskId = notificationId.slice(CONFIRM_NOTIFICATION_PREFIX.length);
    chrome.notifications.clear(notificationId);

    if (buttonIndex === 0) {
      await handleConfirmSent(taskId);
    } else if (buttonIndex === 1) {
      await handleConfirmFailed(taskId);
    }
    return;
  }
});

// Mesma chave usada pelo content script pra ler injeção pendente no boot.
// Mantida em sync manual com whatsapp.ts (PENDING_INJECT_KEY).
const PENDING_INJECT_STORAGE_KEY = 'tribocrm-pending-inject';

async function handlePrepOpen(taskId: string): Promise<void> {
  const prep = await readPrepData(taskId);
  if (!prep) {
    log.warn('Sem prep-data pra essa tarefa — pode ter sido limpa', taskId);
    return;
  }

  // Salva pendingInject ANTES de qualquer navegação. Quando o content
  // script bootar (ou re-bootar após URL change), consumePendingInject
  // vai ler isso e injetar o texto. Independe de mensagem em runtime —
  // sem race conditions de aba nova vs listener pronto.
  await chrome.storage.local.set({
    [PENDING_INJECT_STORAGE_KEY]: {
      taskId: prep.taskId,
      phone: prep.phone,
      body: prep.body,
      leadName: prep.leadName,
      ts: Date.now()
    }
  });

  // Navega direto pra /send?phone=X. Aba existente: troca URL (recarrega).
  // Aba nova: abre já na conversa correta. Em ambos os casos o content
  // script boota nessa URL → conversa abre → injeção dispara automaticamente.
  const sendUrl = `https://web.whatsapp.com/send?phone=${encodeURIComponent(prep.phone)}`;
  const existingTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });

  if (existingTabs.length > 0 && existingTabs[0]?.id) {
    const tab = existingTabs[0];
    await chrome.tabs.update(tab.id!, { active: true, url: sendUrl });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    log.info('Aba do WhatsApp Web atualizada pra /send?phone', { taskId, phone: prep.phone });
  } else {
    await chrome.tabs.create({ url: sendUrl });
    log.info('Aba do WhatsApp Web criada em /send?phone', { taskId, phone: prep.phone });
  }
}

async function handlePrepSnooze(taskId: string): Promise<void> {
  try {
    await api.whatsappTasks.snooze(taskId, 30);
    await clearTaskNotifiedFlag(taskId);
    await clearPrepData(taskId);
    log.info('Tarefa adiada em 30 min', taskId);
  } catch (err) {
    log.error('Falha ao adiar tarefa', taskId, err);
  }
}

async function handleConfirmSent(taskId: string): Promise<void> {
  try {
    await api.whatsappTasks.markSent(taskId);
    await clearPrepData(taskId);
    log.info('Tarefa marcada como enviada', taskId);
  } catch (err) {
    log.error('Falha ao marcar enviada', taskId, err);
  }
}

async function handleConfirmFailed(taskId: string): Promise<void> {
  try {
    await api.whatsappTasks.markFailed(taskId, 'Vendedor reportou falha pelo painel');
    await clearPrepData(taskId);
    // Badge vermelho pra sinalizar que tem falha — vendedor abre o CRM e vê
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    log.info('Tarefa marcada como falhou', taskId);
  } catch (err) {
    log.error('Falha ao marcar falhou', taskId, err);
  }
}

// ── Inicialização ────────────────────────────────────────────────

initScheduler();
log.info('Service worker inicializado');
