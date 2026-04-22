/**
 * Handlers que respondem a cada tipo de mensagem vinda dos content scripts / popup.
 *
 * Padrão: cada handler recebe o payload tipado e retorna o dado bruto.
 * O service-worker principal embrulha no formato { ok, data } ou { ok, error }.
 */

import { api } from '@shared/api';
import { storage } from '@shared/utils/storage';
import type {
  ExtensionMessage,
  MessageResponseMap
} from '@shared/types/messages';
import type { LeadTask } from '@shared/types/extra';

type HandlerMap = {
  [K in ExtensionMessage['type']]: (
    payload: Extract<ExtensionMessage, { type: K }> extends { payload: infer P } ? P : undefined
  ) => Promise<MessageResponseMap[K]>;
};

const TASK_ALARM_PREFIX = 'task:';

/**
 * Agenda o alarm local pra uma task. Se dueAt já passou, NÃO agenda
 * (evita notificação instantânea surpreendente); quem chama deve setar
 * notified=true nesse caso.
 */
async function scheduleTaskAlarm(task: LeadTask): Promise<void> {
  const when = Date.parse(task.dueAt);
  if (!Number.isFinite(when)) return;
  if (when <= Date.now()) return;
  await chrome.alarms.create(`${TASK_ALARM_PREFIX}${task.id}`, { when });
}

async function clearTaskAlarm(taskId: string): Promise<void> {
  await chrome.alarms.clear(`${TASK_ALARM_PREFIX}${taskId}`);
}

export const handlers: HandlerMap = {
  AUTH_LOGIN: async (payload) => {
    const user = await api.auth.login(payload.email, payload.password);
    return { userId: user.id, email: user.email };
  },

  AUTH_LOGOUT: async () => {
    // Limpa dados locais de leads ANTES do logout pra evitar
    // vazamento entre sessões em navegadores compartilhados.
    await storage.clearAllLeadData();
    await api.auth.logout();
    return null;
  },

  AUTH_GET_STATE: async () => {
    const user = await api.auth.getCurrentUser();
    return {
      isAuthenticated: user !== null,
      email: user?.email
    };
  },

  LEAD_FIND_BY_PHONE: async (payload) => {
    return api.leads.findByPhone(payload.phone);
  },

  LEAD_CREATE: async (payload) => {
    return api.leads.create(payload);
  },

  LEAD_UPDATE_STAGE: async (payload) => {
    return api.leads.updateStage(payload.leadId, payload.stageId);
  },

  INTERACTION_LIST: async (payload) => {
    return api.leads.listInteractions(payload.leadId);
  },

  STAGE_LIST: async (payload) => {
    return api.leads.listStages(payload.pipelineId);
  },

  INTERACTION_CREATE: async (payload) => {
    return api.leads.registerInteraction(payload.leadId, payload.type, payload.description);
  },

  TASK_CREATE: async (payload) => {
    return api.leads.createTask(payload);
  },

  TEMPLATE_LIST: async () => {
    return api.messages.listTemplates();
  },

  MESSAGE_SCHEDULE: async (payload) => {
    return api.messages.schedule(payload);
  },

  NOTES_GET: async (payload) => {
    return api.notes.getNotes(payload.leadId);
  },

  NOTES_SET: async (payload) => {
    await api.notes.setNotes(payload.leadId, payload.text);
    return null;
  },

  PRODUCTS_CATALOG: async () => {
    return api.products.listCatalog();
  },

  PRODUCTS_GET_FOR_LEAD: async (payload) => {
    return api.products.getLeadProducts(payload.leadId);
  },

  PRODUCTS_SET_FOR_LEAD: async (payload) => {
    await api.products.setLeadProducts(payload.leadId, payload.items);
    return null;
  },

  // ── Tarefas por lead ────────────────────────────────────────────

  LEAD_TASK_LIST: async (payload) => {
    return api.tasks.listTasks(payload.leadId);
  },

  LEAD_TASK_CREATE: async (payload) => {
    const now = new Date();
    const dueMs = Date.parse(payload.dueAt);
    const isPast = Number.isFinite(dueMs) && dueMs <= now.getTime();

    const task: LeadTask = {
      id: crypto.randomUUID(),
      leadId: payload.leadId,
      leadName: payload.leadName,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      dueAt: payload.dueAt,
      status: 'pending',
      createdAt: now.toISOString(),
      completedAt: null,
      // Se dueAt já passou, entra como notified=true e sem alarm.
      // Evita pop-up instantâneo surpreendente; a task aparece como "vencida".
      notified: isPast
    };

    const saved = await api.tasks.addTask(payload.leadId, task);
    if (!isPast) {
      await scheduleTaskAlarm(saved);
    }
    return saved;
  },

  LEAD_TASK_UPDATE: async (payload) => {
    const existing = (await api.tasks.listTasks(payload.leadId)).find(
      (t) => t.id === payload.taskId
    );
    if (!existing) throw new Error('Tarefa não encontrada');

    const dueChanged =
      typeof payload.patch.dueAt === 'string' &&
      payload.patch.dueAt !== existing.dueAt;

    // Reset notified só se dueAt mudou
    const patch: Partial<LeadTask> = dueChanged
      ? { ...payload.patch, notified: false }
      : payload.patch;

    const updated = await api.tasks.updateTask(payload.leadId, payload.taskId, patch);

    if (dueChanged) {
      await clearTaskAlarm(payload.taskId);
      if (updated.status === 'pending') {
        // scheduleTaskAlarm trata internamente o caso dueAt<now (não agenda).
        await scheduleTaskAlarm(updated);
        // Se o novo dueAt também está no passado, seta notified=true
        // (mesmo racional do create).
        const newDueMs = Date.parse(updated.dueAt);
        if (Number.isFinite(newDueMs) && newDueMs <= Date.now()) {
          return api.tasks.updateTask(payload.leadId, payload.taskId, {
            notified: true
          });
        }
      }
    }

    return updated;
  },

  LEAD_TASK_DELETE: async (payload) => {
    await clearTaskAlarm(payload.taskId);
    await api.tasks.deleteTask(payload.leadId, payload.taskId);
    return null;
  },

  LEAD_TASK_MARK: async (payload) => {
    const updated = await api.tasks.markStatus(
      payload.leadId,
      payload.taskId,
      payload.status
    );
    if (payload.status === 'done') {
      await clearTaskAlarm(payload.taskId);
    } else {
      // voltou para pending — reagenda se ainda faz sentido
      const dueMs = Date.parse(updated.dueAt);
      if (Number.isFinite(dueMs) && dueMs > Date.now()) {
        // Reset notified porque é uma "nova chance" de disparar
        const reset = await api.tasks.updateTask(
          payload.leadId,
          payload.taskId,
          { notified: false }
        );
        await scheduleTaskAlarm(reset);
        return reset;
      }
    }
    return updated;
  },

  // Esta mensagem VAI do service worker PARA o content script.
  // Não tem handler no SW — o handler está no whatsapp.ts.
  MESSAGE_SEND_NOW: async () => null
};
