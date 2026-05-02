/**
 * Content script do WhatsApp Web.
 *
 * FLUXO:
 *   1. Espera o WhatsApp Web terminar de carregar (usuário logado)
 *   2. Monta o container do painel (oculto) e o botão flutuante laranja
 *   3. Lê storage (panelOpen) e viewport para decidir estado inicial
 *   4. Aplica layout inline no WhatsApp (empurra para a esquerda) se aberto
 *   5. Observa mudanças de conversa ativa e redimensionamento da janela
 *
 * NOTA: este arquivo tem imports (diferente dos stubs do LinkedIn/Gmail).
 * O Vite+CRXJS vai criar chunks locais mas todos são carregados de uma vez
 * na injeção via <script type="module"> — sem imports dinâmicos em runtime,
 * então não reproduz o problema "chrome-extension://invalid/".
 */

import { h, render } from 'preact';
import { Panel } from '../panel/Panel';
import {
  onActiveChatChange,
  waitForWhatsAppReady,
  type ChatInfo
} from './whatsapp-dom';
import { mountPanelContainer } from './panel-mount';
import { getPanelOpen, setPanelOpen } from '@shared/utils/panel-state';
import {
  applyInlineLayout,
  isViewportTooNarrow,
  onViewportResize
} from './whatsapp-layout';
import {
  captureHintFromUrl,
  captureHintFromStorage,
  consumePhoneHint,
  watchUrlForHint,
  watchStorageForHint
} from './whatsapp-phone-hint';
import { injectTextIntoChat } from './whatsapp-input';
import { createLogger } from '@shared/utils/logger';
import type { SendScheduledMessageNotify } from '@shared/types/messages';

const log = createLogger('whatsapp');

// Storage key compartilhada com service-worker — content script lê
// no boot pra retomar injeção após navegar pra /send?phone=X.
const PENDING_INJECT_KEY = 'tribocrm-pending-inject';
const PENDING_INJECT_TTL_MS = 5 * 60 * 1000; // 5 min

interface PendingInject {
  taskId: string;
  phone: string;
  body: string;
  leadName: string;
  ts: number;
}

log.info('Content script injetado em', window.location.hostname);

// Captura o hint imediatamente — duas fontes em paralelo:
//   - URL (hash/query) pra fallback de versoes antigas do CRM
//   - chrome.storage.local pra mensagens do CRM via externally_connectable
// E assina mudancas em ambos pra recapturar quando o vendedor
// clica no botao do CRM com WA Web ja aberto.
captureHintFromUrl();
void captureHintFromStorage();
watchUrlForHint();
watchStorageForHint();

interface AppState {
  chatInfo: ChatInfo;
  isOpen: boolean;
  isNarrow: boolean;
}

const state: AppState = {
  chatInfo: { kind: 'none' },
  isOpen: false,
  isNarrow: false
};

let mount: ReturnType<typeof mountPanelContainer> | null = null;
let container: HTMLElement | null = null;
let toggleButton: HTMLButtonElement | null = null;

function renderPanel() {
  if (!container) return;
  render(
    h(Panel, {
      chatInfo: state.chatInfo,
      isOpen: state.isOpen,
      isNarrow: state.isNarrow,
      onClose: () => {
        setOpen(false);
      }
    }),
    container
  );
}

/**
 * Aplica o estado atual ao DOM: visibilidade do container, layout do
 * WhatsApp, visibilidade do toggle e re-render do Preact.
 */
function applyState(): void {
  if (!mount || !toggleButton) return;

  const effectiveOpen = state.isOpen && !state.isNarrow;

  mount.setPanelVisible(effectiveOpen);
  applyInlineLayout(effectiveOpen);

  if (effectiveOpen) {
    toggleButton.classList.add('tribocrm-hidden');
  } else {
    toggleButton.classList.remove('tribocrm-hidden');
  }

  renderPanel();
}

function setOpen(open: boolean): void {
  state.isOpen = open;
  void setPanelOpen(open);
  applyState();
}

function showStandaloneToast(msg: string): void {
  const el = document.createElement('div');
  el.className = 'tribocrm-standalone-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  window.setTimeout(() => {
    el.remove();
  }, 2500);
}

function createToggleButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'tribocrm-toggle';
  btn.textContent = 'TriboCRM';
  btn.title = 'Abrir painel TriboCRM';
  btn.addEventListener('click', () => {
    if (state.isNarrow) {
      showStandaloneToast('Amplie a janela para usar o TriboCRM');
      return;
    }
    setOpen(!state.isOpen);
  });
  document.body.appendChild(btn);
  return btn;
}

// ── Injeção de mensagem agendada (Fase 2 - Opção C) ─────────────────
//
// Estratégia: o content script só toca no compositor do WA *depois* de
// uma ação explícita do vendedor (clique em "Abrir e preparar" na
// notificação). NUNCA injeta automaticamente sem essa autorização.
//
// O fluxo passa por dois caminhos possíveis:
//   1. Aba do WA já estava no contato certo → MESSAGE_SEND_NOW chega,
//      injetamos direto, mandamos INJECT_DONE.
//   2. Aba estava em outro contato (ou em "nenhuma conversa") → salvamos
//      pendingInject no storage e navegamos. Após o reload, o boot()
//      lê do storage, espera DOM pronto e injeta.

async function tryInjectAndConfirm(payload: PendingInject | { taskId: string; phone: string; body: string; leadName: string }): Promise<boolean> {
  const ok = injectTextIntoChat(payload.body);
  if (!ok) {
    log.warn('Falha ao injetar texto no compositor');
    return false;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'INJECT_DONE',
      payload: { taskId: payload.taskId, leadName: payload.leadName }
    });
  } catch (err) {
    log.warn('Falha ao notificar SW sobre INJECT_DONE', err);
  }
  return true;
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

async function handleSendNowMessage(payload: SendScheduledMessageNotify['payload']): Promise<void> {
  const taskId = payload.taskId ?? payload.messageId;
  const leadName = payload.leadName ?? 'Lead';
  const phone = onlyDigits(payload.phone);

  if (!taskId || !phone || !payload.body) {
    log.warn('MESSAGE_SEND_NOW com payload incompleto');
    return;
  }

  // Está na conversa correta? `state.chatInfo` é mantido pelo callback
  // de onActiveChatChange. Comparação por número (sufixo) tolera DDIs/zeros.
  const currentPhone =
    state.chatInfo.kind === 'detected'
      ? onlyDigits(state.chatInfo.contact.phone)
      : null;
  const samePhone = currentPhone && (currentPhone === phone || currentPhone.endsWith(phone) || phone.endsWith(currentPhone));

  if (samePhone) {
    log.info('Aba já está na conversa correta — injetando direto');
    await tryInjectAndConfirm({ taskId, phone, body: payload.body, leadName });
    return;
  }

  // Não está na conversa — salva no storage e navega. Após reload do
  // content script, boot() vai ler isso e completar a injeção.
  const pending: PendingInject = {
    taskId,
    phone,
    body: payload.body,
    leadName,
    ts: Date.now()
  };
  await chrome.storage.local.set({ [PENDING_INJECT_KEY]: pending });
  log.info('Navegando para conversa do lead via /send?phone=', phone);
  window.location.href = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}`;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'MESSAGE_SEND_NOW') {
    handleSendNowMessage(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        log.error('Erro em handleSendNowMessage', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // mantém canal aberto para resposta async
  }
  return false; // outras mensagens não são deste listener
});

async function consumePendingInject(): Promise<void> {
  const result = await chrome.storage.local.get(PENDING_INJECT_KEY);
  const pending = result[PENDING_INJECT_KEY] as PendingInject | undefined;
  if (!pending) return;

  const isStale = Date.now() - pending.ts > PENDING_INJECT_TTL_MS;
  if (isStale) {
    log.info('pendingInject expirado — limpando sem injetar', pending.taskId);
    await chrome.storage.local.remove(PENDING_INJECT_KEY);
    return;
  }

  log.info('Retomando injeção após navegação', pending.taskId);
  // Aguarda mais um pouco pro compositor estar realmente disponível.
  // waitForWhatsAppReady já resolveu antes de chegar aqui, mas o input
  // pode levar 1-2s extras pra aparecer após o /send?phone=.
  for (let i = 0; i < 8; i++) {
    const ok = await tryInjectAndConfirm(pending);
    if (ok) {
      await chrome.storage.local.remove(PENDING_INJECT_KEY);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  log.warn('Não conseguiu injetar após retries — limpando', pending.taskId);
  await chrome.storage.local.remove(PENDING_INJECT_KEY);
}

async function boot() {
  try {
    log.info('Aguardando WhatsApp Web carregar...');
    await waitForWhatsAppReady();
    log.info('WhatsApp Web pronto, montando painel.');

    mount = mountPanelContainer();
    container = mount.container;
    toggleButton = createToggleButton();

    state.isNarrow = isViewportTooNarrow();
    state.isOpen = await getPanelOpen();

    applyState();

    onViewportResize(() => {
      const nowNarrow = isViewportTooNarrow();
      if (nowNarrow === state.isNarrow) return;
      state.isNarrow = nowNarrow;
      log.info('viewport agora', nowNarrow ? 'estreito' : 'amplo');
      applyState();
    });

    onActiveChatChange((chatInfo) => {
      // Promove needs-phone → detected se houver hint vindo do CRM.
      // Caso típico: vendedor clicou em "WhatsApp" no app.tribocrm.com.br
      // e caiu numa conversa cujo contato está salvo na agenda do
      // WhatsApp (header mostra nome, não número). O CRM já passou o
      // telefone via hash; usamos esse pra identificar o lead.
      if (chatInfo.kind === 'needs-phone') {
        const hint = consumePhoneHint();
        if (hint) {
          log.info('Promovendo needs-phone → detected via hint do CRM:', hint);
          chatInfo = {
            kind: 'detected',
            contact: { displayName: chatInfo.detectedName, phone: hint }
          };
        }
      }

      state.chatInfo = chatInfo;
      switch (chatInfo.kind) {
        case 'detected':
          log.info('Conversa ativa com telefone:', chatInfo.contact.displayName);
          break;
        case 'needs-phone':
          log.info('Conversa ativa sem telefone detectável:', chatInfo.detectedName);
          break;
        case 'none':
          log.info('Nenhuma conversa aberta.');
          break;
      }
      renderPanel();
    });

    // Após boot completo, verifica se há injeção pendente vinda de um
    // navigate anterior. Se sim, completa o fluxo agora.
    void consumePendingInject();
  } catch (err) {
    log.error('Erro no boot:', err);
  }
}

if (document.readyState === 'complete') {
  boot();
} else {
  window.addEventListener('load', boot);
}
