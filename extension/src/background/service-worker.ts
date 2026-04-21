/**
 * Service Worker da extensão TriboCRM.
 *
 * RESPONSABILIDADES
 *   1. Escutar mensagens dos content scripts / popup e rotear para os handlers
 *   2. Inicializar o scheduler de mensagens agendadas
 *   3. Reagir a eventos do ciclo de vida da extensão (instalação, atualização)
 *
 * LIMITAÇÕES CRÍTICAS DE V3
 *   - Este worker DORME após ~30s sem eventos. Nada de estado em variáveis globais.
 *   - Qualquer dado que precise persistir vai pro chrome.storage.
 *   - Todos os handlers são assíncronos. Se retornar Promise, é preciso retornar `true`
 *     no onMessage para manter o canal aberto até a Promise resolver.
 */

import { handlers } from './handlers';
import { initScheduler } from './scheduler';
import { createResponder } from '@shared/utils/messaging';
import { createLogger } from '@shared/utils/logger';
import type { ExtensionMessage } from '@shared/types/messages';

const log = createLogger('service-worker');

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
  initScheduler();
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

// ── Inicialização ────────────────────────────────────────────────

initScheduler();
log.info('Service worker inicializado');
