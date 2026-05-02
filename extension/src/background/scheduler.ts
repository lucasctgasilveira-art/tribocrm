/**
 * Scheduler de mensagens agendadas via Tarefa (Fase 2 - Opção C).
 *
 * Por que chrome.alarms e não setInterval?
 *   Service workers V3 DORMEM após ~30s sem atividade. setInterval
 *   não sobrevive ao suspend; chrome.alarms sim.
 *
 * Fluxo (Opção C — notificação primeiro, navegação só com clique):
 *   1. Alarme dispara a cada 1 minuto
 *   2. Busca /tasks/pending-whatsapp (sendStatus=PENDING + dueDate <= now)
 *   3. Para cada tarefa ainda não notificada nesta sessão, dispara
 *      chrome.notifications com 2 botões: "Abrir e preparar" / "Adiar 30 min"
 *   4. Marca taskId como notificado em chrome.storage local pra não duplicar
 *   5. NÃO toca na aba do WhatsApp Web — vendedor decide quando interagir
 *
 * O que acontece DEPOIS está em service-worker.ts:
 *   - chrome.notifications.onButtonClicked → navega+injeta OU adia
 *   - INJECT_DONE → dispara segunda notificação (Enviei/Não enviou)
 *   - Segunda notificação onButtonClicked → POST /whatsapp-sent ou /whatsapp-failed
 */

import { api } from '@shared/api';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('scheduler');

const ALARM_NAME = 'tribocrm-scheduled-messages';
const CHECK_INTERVAL_MINUTES = 1;
const NOTIFIED_KEY = (taskId: string) => `whatsapp-task-notified:${taskId}`;
const PREP_DATA_KEY = (taskId: string) => `whatsapp-prep-data:${taskId}`;
export const PREP_NOTIFICATION_PREFIX = 'whatsapp-prep:';

export interface PrepData {
  taskId: string;
  leadId: string;
  leadName: string;
  phone: string;
  body: string;
  ts: number;
}

export function initScheduler() {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
    delayInMinutes: 0.1
  });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    await checkPendingTasks();
  });

  log.info('Scheduler iniciado');
}

async function isTaskNotified(taskId: string): Promise<boolean> {
  const result = await chrome.storage.local.get(NOTIFIED_KEY(taskId));
  return Boolean(result[NOTIFIED_KEY(taskId)]);
}

async function markTaskNotified(taskId: string): Promise<void> {
  await chrome.storage.local.set({ [NOTIFIED_KEY(taskId)]: Date.now() });
}

/**
 * Trunca o body pra caber na notificação (que tem espaço limitado).
 * Mantém preview legível mas não estoura o card.
 */
function truncateForNotification(body: string, max: number = 110): string {
  const single = body.replace(/\s+/g, ' ').trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}

async function checkPendingTasks() {
  const isAuthed = await api.auth.isAuthenticated();
  if (!isAuthed) {
    log.debug('Sem sessão, pulando ciclo');
    return;
  }

  const permission = await new Promise<string>((resolve) =>
    chrome.notifications.getPermissionLevel((level) => resolve(level))
  );
  if (permission !== 'granted') {
    log.warn('Notificações desativadas no Chrome — não é possível avisar o vendedor');
    return;
  }

  let pending;
  try {
    pending = await api.whatsappTasks.listPending();
  } catch (err) {
    log.error('Falha ao listar tarefas pendentes', err);
    return;
  }

  if (pending.length === 0) return;

  log.info(`${pending.length} tarefa(s) WhatsApp pendente(s)`);

  for (const task of pending) {
    if (await isTaskNotified(task.id)) {
      log.debug('Tarefa já notificada nesta sessão — pulando', task.id);
      continue;
    }

    const leadName = task.lead?.name ?? 'Lead';
    const phone = (task.lead?.whatsapp ?? task.lead?.phone ?? '').replace(/\D/g, '');

    if (!phone) {
      log.warn('Tarefa sem phone/whatsapp no lead — não dá pra preparar', task.id);
      continue;
    }

    const preview = truncateForNotification(task.whatsappMessageBody);

    // Salva os dados ANTES de disparar a notificação. Quando o vendedor
    // clicar em "Abrir e preparar", o handler vai ler isso pra navegar
    // e injetar — sem precisar fazer nova chamada à API.
    const prep: PrepData = {
      taskId: task.id,
      leadId: task.leadId,
      leadName,
      phone,
      body: task.whatsappMessageBody,
      ts: Date.now()
    };
    await chrome.storage.local.set({ [PREP_DATA_KEY(task.id)]: prep });

    try {
      await new Promise<string>((resolve) => {
        chrome.notifications.create(
          `${PREP_NOTIFICATION_PREFIX}${task.id}`,
          {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
            title: `Mensagem agendada — ${leadName}`,
            message: preview,
            contextMessage: 'TriboCRM',
            priority: 2,
            requireInteraction: true,
            buttons: [
              { title: '📨 Abrir e preparar' },
              { title: '⏰ Adiar 30 min' }
            ]
          },
          (notificationId) => resolve(notificationId)
        );
      });

      await markTaskNotified(task.id);
      log.info('Notificação de preparação disparada', task.id);
    } catch (err) {
      log.error('Falha ao disparar notificação', task.id, err);
      // Limpa prep-data se a notificação falhou — inconsistente manter
      await chrome.storage.local.remove(PREP_DATA_KEY(task.id));
    }
  }
}

export async function readPrepData(taskId: string): Promise<PrepData | null> {
  const result = await chrome.storage.local.get(PREP_DATA_KEY(taskId));
  return (result[PREP_DATA_KEY(taskId)] as PrepData | undefined) ?? null;
}

export async function clearPrepData(taskId: string): Promise<void> {
  await chrome.storage.local.remove(PREP_DATA_KEY(taskId));
}

/**
 * Limpa flag local de notificação pra que a tarefa volte a aparecer
 * no próximo ciclo. Usado quando vendedor adia (snooze) — nova hora
 * exige nova notificação.
 */
export async function clearTaskNotifiedFlag(taskId: string): Promise<void> {
  await chrome.storage.local.remove(NOTIFIED_KEY(taskId));
}
