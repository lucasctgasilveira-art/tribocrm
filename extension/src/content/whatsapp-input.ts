/**
 * Injeção de texto no campo de digitação do WhatsApp Web.
 *
 * Motivação: colar mensagem pronta sem recarregar a conversa (ao contrário
 * da URL whatsapp.com/send, que recarrega). O campo é um contenteditable
 * gerenciado pelo React interno do WA — manipular innerHTML direto não
 * basta; o state interno não reconhece a mudança e o botão de enviar
 * fica desabilitado. Por isso precisamos de eventos de input nativos.
 *
 * ATENÇÃO: convive no tier "frágil" junto com whatsapp-dom.ts. Se parar
 * de funcionar, seletores e/ou API de input podem ter mudado.
 */

import { createLogger } from '@shared/utils/logger';

const log = createLogger('whatsapp-input');

// Seletores validados em 21/04/2026.
// Ordem: primeiro que casar vence. `footer` restringe ao compositor e
// evita colisão com o campo de busca lateral (também contenteditable).
const INPUT_SELECTORS = [
  'footer [contenteditable="true"][data-tab]',
  '[data-testid="conversation-compose-box-input"]',
  'footer div[contenteditable="true"]'
];

function findInput(): HTMLElement | null {
  for (const sel of INPUT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Cola `text` no campo de digitação do WhatsApp, substituindo o conteúdo
 * atual. NÃO envia a mensagem — só deixa pronta para o usuário revisar.
 *
 * @returns true se conseguiu injetar; false se o campo não foi encontrado
 *          (falha recuperável — log.warn, sem throw).
 */
export function injectTextIntoChat(text: string): boolean {
  const el = findInput();
  if (!el) {
    log.warn('Campo de digitação do WhatsApp não encontrado');
    return false;
  }

  el.focus();

  // Seleciona todo o conteúdo atual para que a inserção substitua em vez
  // de anexar (clique num template joga o template, rascunho anterior sai).
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Caminho feliz: execCommand('insertText') notifica o React do WA como
  // se fosse digitação real, mantendo o botão de enviar habilitado.
  // Embora deprecated, é o caminho mais confiável hoje.
  if (document.execCommand('insertText', false, text)) {
    return true;
  }

  // Fallback: manipula o DOM diretamente e dispara InputEvent nativo com
  // inputType/data corretos, que é o que o React interno do WA espera
  // para reconhecer uma inserção de texto.
  try {
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(document.createTextNode(text));

    el.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true
      })
    );
    el.dispatchEvent(
      new InputEvent('input', {
        inputType: 'insertText',
        data: text,
        bubbles: true
      })
    );
    return true;
  } catch (err) {
    log.warn('Falha ao injetar texto via InputEvent', err);
    return false;
  }
}
