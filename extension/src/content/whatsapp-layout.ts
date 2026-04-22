/**
 * Ajusta o layout do WhatsApp Web para abrir espaço ao painel do TriboCRM.
 *
 * Estratégia: dois <style> injetados no <head> do WhatsApp.
 *
 *   #tribocrm-layout-transition  — FIXO, criado no boot e nunca removido.
 *     Contém apenas a regra de transition que anima width/padding do
 *     body e do #app. Manter sempre garante animação suave tanto ao
 *     abrir quanto ao fechar (removendo o override).
 *
 *   #tribocrm-layout-override    — DINÂMICO. Criado ao abrir o painel,
 *     removido ao fechar. Contém padding-right/width com !important
 *     (necessário porque o WhatsApp define width inline em px no body
 *     e no #app).
 *
 * LIMITAÇÃO CONHECIDA: se a extensão é desativada/removida sem reload
 * da aba, os <style> podem persistir até um reload do WhatsApp. O
 * content script não recebe evento síncrono de unload que garanta
 * limpeza. Aceito para o MVP.
 */

import { createLogger } from '@shared/utils/logger';

const log = createLogger('whatsapp-layout');

const TRANSITION_STYLE_ID = 'tribocrm-layout-transition';
const OVERRIDE_STYLE_ID = 'tribocrm-layout-override';

const PANEL_WIDTH = 360;
const NARROW_BREAKPOINT = 1100;
const RESIZE_DEBOUNCE_MS = 200;

function ensureTransitionStyle(): void {
  if (document.getElementById(TRANSITION_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TRANSITION_STYLE_ID;
  style.textContent = `
    body, #app {
      transition: width 0.2s ease-out, padding 0.2s ease-out;
    }
  `;
  document.head.appendChild(style);
  log.debug('transition style instalado');
}

export function applyInlineLayout(open: boolean): void {
  ensureTransitionStyle();

  const existing = document.getElementById(OVERRIDE_STYLE_ID);

  if (!open) {
    if (existing) {
      existing.remove();
      log.debug('layout override removido');
    }
    return;
  }

  const css = `
    body {
      padding-right: ${PANEL_WIDTH}px !important;
      width: calc(100vw - ${PANEL_WIDTH}px) !important;
    }
    #app {
      width: calc(100vw - ${PANEL_WIDTH}px) !important;
    }
  `;

  if (existing) {
    existing.textContent = css;
    return;
  }

  const style = document.createElement('style');
  style.id = OVERRIDE_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
  log.debug('layout override aplicado');
}

export function isViewportTooNarrow(): boolean {
  return window.innerWidth < NARROW_BREAKPOINT;
}

/**
 * Escuta resize da janela com debounce de 200ms.
 * Retorna função de unsubscribe (não é chamada no MVP, mas segue o padrão).
 */
export function onViewportResize(callback: () => void): () => void {
  let timerId: number | undefined;

  const handler = () => {
    if (timerId !== undefined) window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      timerId = undefined;
      callback();
    }, RESIZE_DEBOUNCE_MS);
  };

  window.addEventListener('resize', handler);

  return () => {
    window.removeEventListener('resize', handler);
    if (timerId !== undefined) window.clearTimeout(timerId);
  };
}
