/**
 * Content script do WhatsApp Web.
 *
 * FLUXO:
 *   1. Espera o WhatsApp Web terminar de carregar (usuário logado)
 *   2. Monta o container do painel no fim do body
 *   3. Cria botão flutuante "TriboCRM" no canto direito
 *   4. Observa mudanças de conversa ativa com MutationObserver
 *   5. A cada mudança, re-renderiza o Preact passando o novo contato
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
  type WhatsAppContactInfo
} from './whatsapp-dom';
import { mountPanelContainer } from './panel-mount';

const log = {
  info: (...args: unknown[]) =>
    console.log('%c[TriboCRM:whatsapp]', 'color: #3b82f6', ...args),
  error: (...args: unknown[]) =>
    console.error('%c[TriboCRM:whatsapp]', 'color: #ef4444', ...args)
};

log.info('Content script injetado em', window.location.hostname);

interface AppState {
  contact: WhatsAppContactInfo | null;
  isOpen: boolean;
}

const state: AppState = {
  contact: null,
  isOpen: false
};

let container: HTMLElement | null = null;
let toggleButton: HTMLButtonElement | null = null;

function renderPanel() {
  if (!container) return;
  render(
    h(Panel, {
      contact: state.contact,
      isOpen: state.isOpen,
      onClose: () => {
        state.isOpen = false;
        toggleButton?.classList.remove('tribocrm-hidden');
        renderPanel();
      }
    }),
    container
  );
}

function createToggleButton() {
  const btn = document.createElement('button');
  btn.className = 'tribocrm-toggle';
  btn.textContent = 'TriboCRM';
  btn.title = 'Abrir painel TriboCRM';
  btn.addEventListener('click', () => {
    state.isOpen = true;
    btn.classList.add('tribocrm-hidden');
    renderPanel();
  });
  document.body.appendChild(btn);
  return btn;
}

async function boot() {
  try {
    log.info('Aguardando WhatsApp Web carregar...');
    await waitForWhatsAppReady();
    log.info('WhatsApp Web pronto, montando painel.');

    const mount = mountPanelContainer();
    container = mount.container;
    toggleButton = createToggleButton();

    renderPanel();

    onActiveChatChange((contact) => {
      state.contact = contact;
      log.info('Conversa ativa:', contact?.displayName ?? '(nenhuma)');
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
