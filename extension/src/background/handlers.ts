/**
 * Handlers que respondem a cada tipo de mensagem vinda dos content scripts / popup.
 *
 * Padrão: cada handler recebe o payload tipado e retorna o dado bruto.
 * O service-worker principal embrulha no formato { ok, data } ou { ok, error }.
 */

import { api } from '@shared/api';
import { storage } from '@shared/utils/storage';
import { createLogger } from '@shared/utils/logger';
import type {
  ExtensionMessage,
  MessageResponseMap
} from '@shared/types/messages';
import type { LeadTask, LeadOutcome } from '@shared/types/extra';

const log = createLogger('handlers');

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

/**
 * Resolve a stage "Vendido" ou "Perdido" no pipeline dado.
 * Estratégia: procura primeiro por type (WON/LOST), que é o sinal forte
 * do backend. Se não achar, tenta match por nome contendo "vendido"/"perdido"
 * (caso um pipeline customizado não tenha o type mas tenha o nome).
 * Retorna null se não encontrar — caller deve tratar silenciosamente.
 */
async function resolveOutcomeStage(
  pipelineId: string,
  kind: LeadOutcome['kind']
): Promise<string | null> {
  try {
    const stages = await api.leads.listStages(pipelineId);
    const wantedType = kind === 'won' ? 'WON' : 'LOST';
    const fallbackName = kind === 'won' ? 'vendido' : 'perdido';
    const stage =
      stages.find((s) => s.type === wantedType) ??
      stages.find((s) => s.name.toLowerCase().includes(fallbackName));
    return stage?.id ?? null;
  } catch (err) {
    log.warn('Falha ao listar stages para resolver outcome', err);
    return null;
  }
}

/**
 * Sincroniza o outcome local com a etapa atual do lead. Se houver um
 * outcome gravado cujo kind não bate com o type da nova stage (WON/LOST),
 * apaga o outcome. Caso contrário, mantém.
 *
 * Regra:
 *   - stage WON  + outcome.kind 'won'  → mantém
 *   - stage LOST + outcome.kind 'lost' → mantém
 *   - qualquer outra combinação        → clearOutcome
 *
 * Disparada só pelo handler LEAD_UPDATE_STAGE (mudança manual de etapa).
 * O fluxo "Marcar venda/perda" chama api.leads.updateStage diretamente
 * (sem passar por esse handler), evitando limpar um outcome recém-criado.
 * Falhas são silenciosas — o update da stage é o que importa.
 */
async function syncOutcomeWithStage(
  leadId: string,
  updatedLead: { stage: { id: string }; pipeline: { id: string } }
): Promise<void> {
  try {
    const current = await api.outcome.getOutcome(leadId);
    if (!current) return;

    const stages = await api.leads.listStages(updatedLead.pipeline.id);
    const newStage = stages.find((s) => s.id === updatedLead.stage.id);
    if (!newStage) return;

    const matches =
      (newStage.type === 'WON' && current.kind === 'won') ||
      (newStage.type === 'LOST' && current.kind === 'lost');

    if (!matches) {
      await api.outcome.clearOutcome(leadId);
      log.info('Outcome limpo: etapa mudou e não é mais compatível', {
        leadId,
        newStageType: newStage.type,
        outcomeKind: current.kind
      });
    }
  } catch (err) {
    log.warn('Falha ao sincronizar outcome com etapa — ignorado', err);
  }
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

  LEAD_FIND_BY_ID: async (payload) => {
    return api.leads.findById(payload.leadId);
  },

  LEAD_SEARCH: async (payload) => {
    return api.leads.search(payload.query);
  },

  LEAD_SEARCH_BY_NAME: async (payload) => {
    return api.leads.searchByName(payload.name, payload.limit ?? 5);
  },

  PIPELINE_LIST: async () => {
    return api.leads.listPipelines();
  },

  LEAD_CREATE: async (payload) => {
    return api.leads.create(payload);
  },

  LEAD_UPDATE_STAGE: async (payload) => {
    const updated = await api.leads.updateStage(payload.leadId, payload.stageId);
    await syncOutcomeWithStage(payload.leadId, updated);
    return updated;
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
    return api.products.setLeadProducts(payload.leadId, payload.items);
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

    // Repassa campos da Fase 1 (mensagem WhatsApp agendada). Backend ignora
    // se type !== 'WHATSAPP' ou se dueDate ausente.
    const saved = await api.tasks.addTask(payload.leadId, task, {
      whatsappTemplateId: payload.whatsappTemplateId,
      whatsappMessageBody: payload.whatsappMessageBody,
    });
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

  // ── Outcome por lead ───────────────────────────────────────────

  LEAD_OUTCOME_GET: async (payload) => {
    return api.outcome.getOutcome(payload.leadId);
  },

  LEAD_OUTCOME_SET: async (payload) => {
    // Resolve a stage WON/LOST do pipeline ANTES de chamar setOutcome —
    // o service real (HTTP) faz UM ÚNICO PATCH /leads/:id com stageId +
    // closedValue + lossReasonId + wonAt/lostAt no mesmo body. Sem stage
    // resolvida, o outcome ficaria sem destino válido — abortamos com
    // warn (mesma semântica do código anterior).
    const stageId = await resolveOutcomeStage(
      payload.pipelineId,
      payload.outcome.kind
    );
    if (!stageId) {
      log.warn(
        'Stage de outcome não encontrada no pipeline — outcome não persistido',
        { pipelineId: payload.pipelineId, kind: payload.outcome.kind }
      );
      return null;
    }

    try {
      await api.outcome.setOutcome(payload.leadId, payload.outcome, stageId);
    } catch (err) {
      log.warn('Falha ao salvar outcome', err);
    }
    return null;
  },

  LEAD_OUTCOME_CLEAR: async (payload) => {
    await api.outcome.clearOutcome(payload.leadId);
    return null;
  },

  LOSS_REASONS_LIST: async () => {
    return api.outcome.listLossReasons();
  },

  // ── Telefones alternativos ──────────────────────────────────────

  ALT_PHONE_LINK: async (payload) => {
    await api.altPhones.link(payload.phone, payload.leadId);
    return null;
  },

  ALT_PHONE_UNLINK: async (payload) => {
    await api.altPhones.unlink(payload.phone);
    return null;
  },

  ALT_PHONE_FIND_LEAD_ID: async (payload) => {
    return api.altPhones.findLeadIdByPhone(payload.phone);
  },

  // Esta mensagem VAI do service worker PARA o content script.
  // Não tem handler no SW — o handler está no whatsapp.ts.
  MESSAGE_SEND_NOW: async () => null,

  // Content script avisa que injetou texto com sucesso no compositor
  // do WhatsApp. SW dispara segunda notificação ("Enviei" / "Não enviou")
  // pra fechar o ciclo. Tarefa fica PENDING até vendedor confirmar.
  INJECT_DONE: async (payload) => {
    const { taskId, leadName } = payload;
    const permission = await new Promise<string>((resolve) =>
      chrome.notifications.getPermissionLevel((level) => resolve(level))
    );
    if (permission !== 'granted') {
      log.warn('Notificações desativadas — não posso confirmar com o vendedor', taskId);
      return null;
    }

    await new Promise<string>((resolve) => {
      chrome.notifications.create(
        `whatsapp-confirm:${taskId}`,
        {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
          title: `Texto inserido — ${leadName}`,
          message: 'Revise e envie. Depois confirme aqui.',
          contextMessage: 'TriboCRM',
          priority: 2,
          requireInteraction: true,
          buttons: [
            { title: '✓ Enviei' },
            { title: '✗ Não enviou' }
          ]
        },
        (notificationId) => resolve(notificationId)
      );
    });
    return null;
  }
};
