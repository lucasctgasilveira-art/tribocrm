/**
 * Phone hint vindo do CRM.
 *
 * Duas fontes possiveis, em ordem de prioridade:
 *
 *   1. chrome.storage.local key 'crm-phone-hint' — gravado pelo
 *      service worker quando o frontend do CRM envia mensagem via
 *      chrome.runtime.sendMessage(extId, ...). E o caminho ROBUSTO,
 *      independente de URL/hash. TTL de 5 min — hints antigos sao
 *      ignorados pra nao vazar pra conversas nao relacionadas.
 *
 *   2. window.location (hash ou query) — fallback caso o vendedor
 *      use uma versao antiga do frontend ou a mensagem nao tenha
 *      chegado em tempo. Padrao: ?tribocrm-phone= ou #tribocrm-phone=
 *
 * Em ambos os casos, "consumo unico": apos consumePhoneHint() o
 * hint e descartado, evitando vazar pra proxima conversa que o
 * vendedor abrir manualmente.
 */

import { createLogger } from '@shared/utils/logger';
import { normalizePhone } from '@shared/utils/phone';

const log = createLogger('whatsapp-phone-hint');

const HASH_KEY = 'tribocrm-phone';
const STORAGE_KEY = 'crm-phone-hint';
const HINT_TTL_MS = 5 * 60 * 1000; // 5 min

let pendingHint: string | null = null;
let pendingLeadId: string | null = null;

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
 * Le hint do chrome.storage.local (gravado pelo service worker
 * quando o CRM envia mensagem via externally_connectable).
 *
 * Aplica TTL de 5 min: hints mais antigos sao descartados e a
 * chave e limpa do storage. Isso evita que um hint de horas atras
 * apareça quando o vendedor abre o WhatsApp Web pra outra finalidade.
 *
 * Idempotente: pode ser chamada varias vezes. Se houver hint valido,
 * pendingHint e atualizado; senao, mantem o que tinha.
 */
export async function captureHintFromStorage(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        const entry = data?.[STORAGE_KEY] as
          | { phone: string; leadId: string | null; ts: number }
          | undefined;

        if (!entry) {
          if (!pendingHint) log.info('Sem hint no storage.');
          resolve(pendingHint);
          return;
        }

        const age = Date.now() - (entry.ts ?? 0);
        if (age > HINT_TTL_MS) {
          log.info('Hint do storage expirado (>' + HINT_TTL_MS + 'ms), descartando.');
          chrome.storage.local.remove(STORAGE_KEY);
          resolve(pendingHint);
          return;
        }

        const normalized = normalizePhone(entry.phone);
        if (!normalized) {
          log.warn('Hint do storage invalido:', entry.phone);
          resolve(pendingHint);
          return;
        }

        pendingHint = normalized;
        pendingLeadId = entry.leadId ?? null;
        log.info('Hint capturado do storage:', normalized, '(leadId:', pendingLeadId, ')');

        // Consome do storage pra nao reaplicar em outras conversas
        chrome.storage.local.remove(STORAGE_KEY);
        resolve(pendingHint);
      });
    } catch (err) {
      log.warn('Falha ao ler storage:', err);
      resolve(pendingHint);
    }
  });
}

/**
 * Assina mudancas no chrome.storage pra capturar hints novos em
 * tempo real — caso o vendedor clique no CRM com WA Web ja aberto.
 */
export function watchStorageForHint(): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName !== 'local') return;
    if (!changes[STORAGE_KEY]) return;
    if (!changes[STORAGE_KEY].newValue) return;
    log.info('Mudanca detectada no storage — recapturando hint');
    void captureHintFromStorage();
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Devolve o hint pendente E marca como consumido (próximas chamadas
 * retornam null). Usado pelo classifier no momento de promover
 * needs-phone → detected.
 */
export function consumePhoneHint(): string | null {
  const hint = pendingHint;
  pendingHint = null;
  pendingLeadId = null;
  return hint;
}

/**
 * Espia o hint sem consumir. Útil pra logs.
 */
export function peekPhoneHint(): string | null {
  return pendingHint;
}

/**
 * Retorna o leadId associado ao hint pendente (se veio do CRM).
 * Util pra otimizacao futura — pular busca por phone e usar leadId
 * direto.
 */
export function peekHintLeadId(): string | null {
  return pendingLeadId;
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
