/**
 * Phone hint vindo do CRM via URL.
 *
 * Quando o vendedor clica em "WhatsApp" dentro do TriboCRM, o frontend
 * abre uma URL com o telefone embutido no hash:
 *
 *   https://web.whatsapp.com/send?phone=5533999317423#tribocrm-phone=5533999317423
 *
 * O WhatsApp Web ignora o hash e redireciona internamente pra conversa.
 * Este módulo captura o hash logo no boot (antes de o redirect remover),
 * guarda em memória e expõe consumo único pra promover o estado
 * `needs-phone` (contato salvo na agenda do WhatsApp, sem número visível
 * no DOM) pra `detected` automaticamente.
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
let captured = false;

/**
 * Lê hash e query da URL atual, captura o phone hint se presente,
 * e remove o marcador da URL (cosmético — evita confusão em refreshes).
 *
 * Idempotente: chamadas seguintes não fazem nada além de retornar o
 * hint já capturado (se ainda não foi consumido).
 */
export function captureHintFromUrl(): string | null {
  if (captured) return pendingHint;
  captured = true;

  const url = new URL(window.location.href);
  const fromHash = parseFromHash(url.hash);
  const fromQuery = url.searchParams.get(HASH_KEY);
  const raw = fromHash ?? fromQuery;

  if (!raw) {
    log.info('Sem hint na URL.');
    return null;
  }

  const normalized = normalizePhone(raw);
  if (!normalized) {
    log.warn('Hint inválido, ignorando:', raw);
    return null;
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
