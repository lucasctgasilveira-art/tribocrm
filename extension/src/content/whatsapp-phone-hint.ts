/**
 * Phone hint vindo do CRM via URL.
 *
 * Quando o vendedor clica em "WhatsApp" dentro do TriboCRM, o frontend
 * abre uma URL com o telefone embutido no hash:
 *
 *   https://web.whatsapp.com/send?phone=5533999317423#tribocrm-phone=5533999317423
 *
 * O WhatsApp Web ignora o hash e redireciona internamente pra conversa.
 * Este módulo captura o hash em tres momentos diferentes pra ser robusto:
 *
 *   1. No boot do content script (URL inicial)
 *   2. Em qualquer hashchange (navegacao SPA com fragment)
 *   3. Apos popstate (navegacao SPA sem fragment)
 *
 * Por que "consumo único":
 *   se o vendedor trocar de chat manualmente depois, o hint não pode
 *   vazar pra próxima conversa — sem isso o painel mostraria o número
 *   errado pra um contato diferente.
 */

import { createLogger } from '@shared/utils/logger';
import { normalizePhone } from '@shared/utils/phone';

const log = createLogger('whatsapp-phone-hint');

const HASH_KEY = 'tribocrm-phone';

let pendingHint: string | null = null;

/**
 * Lê hash e query da URL atual, captura o phone hint se presente,
 * e remove o marcador da URL (cosmético — evita confusão em refreshes).
 *
 * Idempotente: pode ser chamada várias vezes. Se já tem um hint
 * pendente, mantém. Se vier um novo hint da URL, sobrescreve (caso
 * o vendedor abra varios links do CRM em sequencia).
 */
export function captureHintFromUrl(): string | null {
  const url = new URL(window.location.href);
  log.info('Lendo URL pra hint:', url.toString());

  const fromHash = parseFromHash(url.hash);
  const fromQuery = url.searchParams.get(HASH_KEY);
  const raw = fromHash ?? fromQuery;

  if (!raw) {
    if (!pendingHint) log.info('Sem hint na URL.');
    return pendingHint;
  }

  const normalized = normalizePhone(raw);
  if (!normalized) {
    log.warn('Hint inválido, ignorando:', raw);
    return pendingHint;
  }

  pendingHint = normalized;
  log.info('Hint capturado:', normalized);

  // Remove o marcador da URL pra não vazar em refreshes ou prints.
  // Não substitui o histórico — usa replaceState pra não criar
  // entrada nova de navegação.
  try {
    if (fromHash) {
      url.hash = url.hash
        .replace(new RegExp(`(^|&)${HASH_KEY}=[^&]*`), '')
        .replace(/^#&/, '#')
        .replace(/^#$/, '');
    }
    if (fromQuery) {
      url.searchParams.delete(HASH_KEY);
    }
    window.history.replaceState(null, '', url.toString());
  } catch (err) {
    log.warn('Não foi possível limpar a URL:', err);
  }

  return pendingHint;
}

/**
 * Inicia listeners pra re-capturar hint quando a URL muda dentro
 * da SPA do WhatsApp Web. Isso cobre o caso onde o usuario ja tem
 * o WhatsApp Web aberto e clica no botao do CRM em outra aba —
 * a aba do CRM dispara window.open que pode reusar a aba existente
 * (ou se o redirect do wa.me dropou o hash, o hint chega via
 * popstate quando navega).
 */
export function watchUrlForHint(): () => void {
  const handler = () => {
    captureHintFromUrl();
  };

  window.addEventListener('hashchange', handler);
  window.addEventListener('popstate', handler);

  return () => {
    window.removeEventListener('hashchange', handler);
    window.removeEventListener('popstate', handler);
  };
}

/**
 * Devolve o hint pendente E marca como consumido (próximas chamadas
 * retornam null). Usado pelo classifier no momento de promover
 * needs-phone → detected.
 */
export function consumePhoneHint(): string | null {
  const hint = pendingHint;
  pendingHint = null;
  return hint;
}

/**
 * Espia o hint sem consumir. Útil pra logs.
 */
export function peekPhoneHint(): string | null {
  return pendingHint;
}

// O hash do WhatsApp Web pode aparecer como
// "#tribocrm-phone=553399..." ou "#/tribocrm-phone=...".
// Aceita os dois.
function parseFromHash(hash: string): string | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#\/?/, '');
  // Pode haver múltiplos pares separados por &
  for (const pair of cleaned.split('&')) {
    const [k, v] = pair.split('=');
    if (k === HASH_KEY && v) return decodeURIComponent(v);
  }
  return null;
}
