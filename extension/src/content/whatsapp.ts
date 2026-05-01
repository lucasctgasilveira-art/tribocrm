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
import { createLogger } from '@shared/utils/logger';

const log = createLogger('whatsapp');

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
  } catch (err) {
    log.error('Erro no boot:', err);
  }
}

if (document.readyState === 'complete') {
  boot();
} else {
  window.addEventListener('load', boot);
}
