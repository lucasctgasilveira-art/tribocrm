/**
 * Abstração sobre chrome.runtime.sendMessage com:
 *   - Timeout automático (evita travamento quando service worker dorme)
 *   - Tipagem end-to-end via MessageResponseMap
 *   - Erro claro em vez de undefined silencioso
 */

import type {
  ExtensionMessage,
  MessageResponseMap,
  MessageResponse
} from '@shared/types/messages';
import { createLogger } from './logger';

const log = createLogger('messaging');

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Envia uma mensagem para o service worker e aguarda resposta tipada.
 *
 * Uso:
 *   const lead = await sendMessage({
 *     type: 'LEAD_FIND_BY_PHONE',
 *     payload: { phone: '5521912345678' }
 *   });
 */
export function sendMessage<T extends ExtensionMessage>(
  message: T,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<MessageResponseMap[T['type']]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${message.type} não respondeu em ${timeoutMs}ms`));
    }, timeoutMs);

    chrome.runtime.sendMessage(message, (response: MessageResponse) => {
      clearTimeout(timer);

      // chrome.runtime.lastError aparece quando o worker não respondeu
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        log.error('Runtime error em', message.type, runtimeError.message);
        reject(new Error(runtimeError.message));
        return;
      }

      if (!response) {
        reject(new Error(`Sem resposta para ${message.type}`));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error));
        return;
      }

      resolve(response.data as MessageResponseMap[T['type']]);
    });
  });
}

/**
 * Helper que o handler do service worker usa para responder.
 * Garante o formato { ok, data } ou { ok, error }.
 */
export function createResponder(sendResponse: (r: MessageResponse) => void) {
  return {
    ok: <T>(data: T) => sendResponse({ ok: true, data }),
    fail: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendResponse({ ok: false, error: message });
    }
  };
}
