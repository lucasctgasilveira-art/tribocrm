/**
 * Scheduler do job de mensagens agendadas.
 *
 * Por que chrome.alarms e não setInterval?
 *   Service workers V3 DORMEM após ~30s sem atividade.
 *   setInterval não sobrevive ao suspend. chrome.alarms sim.
 *
 * Fluxo:
 *   1. Alarme dispara a cada 1 minuto
 *   2. Busca mensagens PENDING cuja scheduledAt já passou
 *   3. Para cada uma, envia 'MESSAGE_SEND_NOW' pro content script do WhatsApp
 *   4. O content script injeta a mensagem no WhatsApp Web e confirma
 */

import { api } from '@shared/api';
import { createLogger } from '@shared/utils/logger';
import type { SendScheduledMessageNotify } from '@shared/types/messages';

const log = createLogger('scheduler');

const ALARM_NAME = 'tribocrm-scheduled-messages';
const CHECK_INTERVAL_MINUTES = 1;

export function initScheduler() {
  // Cria (ou sobrescreve) o alarme
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
    delayInMinutes: 0.1 // primeiro disparo em ~6 segundos
  });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    await checkPendingMessages();
  });

  log.info('Scheduler iniciado');
}

async function checkPendingMessages() {
  try {
    const pending = await api.messages.listPending();
    const now = Date.now();

    const due = pending.filter((m) => new Date(m.scheduledAt).getTime() <= now);
    if (due.length === 0) return;

    log.info(`${due.length} mensagem(ns) pronta(s) para envio`);

    // Encontra uma aba aberta do WhatsApp Web
    const tabs = await chrome.tabs.query({
      url: 'https://web.whatsapp.com/*'
    });

    if (tabs.length === 0) {
      log.warn('WhatsApp Web não está aberto — abortando envios');
      return;
    }

    const wppTab = tabs[0];
    if (!wppTab.id) return;

    for (const msg of due) {
      const leadPhone = msg.leadId; // em produção, buscaríamos o telefone via /leads/:id
      // Nota: no real, precisamos buscar o lead para pegar o telefone.
      // Aqui deixamos simples — será ajustado na integração real.

      try {
        const notify: SendScheduledMessageNotify = {
          type: 'MESSAGE_SEND_NOW',
          payload: {
            messageId: msg.id,
            phone: leadPhone,
            body: msg.messageBody
          }
        };

        await chrome.tabs.sendMessage(wppTab.id, notify);
        await api.messages.markSent(msg.id);
        log.info('Mensagem enviada', msg.id);
      } catch (err) {
        log.error('Falha ao enviar', msg.id, err);
        await api.messages.markFailed(msg.id);
        // Badge vermelho no ícone
        await chrome.action.setBadgeText({ text: '!' });
        await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      }
    }
  } catch (err) {
    log.error('Erro no ciclo do scheduler', err);
  }
}
