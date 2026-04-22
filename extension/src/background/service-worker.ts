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
import { initScheduler } from './scheduler';
import { api } from '@shared/api';
import { createResponder } from '@shared/utils/messaging';
import { createLogger } from '@shared/utils/logger';
import type { ExtensionMessage } from '@shared/types/messages';

const log = createLogger('service-worker');

const TASK_ALARM_PREFIX = 'task:';

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

// ── Inicialização ────────────────────────────────────────────────

initScheduler();
log.info('Service worker inicializado');
