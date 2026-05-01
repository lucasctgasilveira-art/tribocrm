import type {
  Lead,
  Interaction,
  WhatsAppTemplate,
  ScheduledMessage,
  CreateTaskDTO,
  Stage
} from './domain';
import type {
  Product,
  LeadProduct,
  LeadProductInput,
  LeadTask,
  LeadTaskType,
  LeadTaskStatus,
  LeadOutcome,
  LossReason
} from './extra';

/**
 * Todas as mensagens que trafegam entre os contextos da extensão.
 *
 * Padrão: cada mensagem tem um `type` string e um `payload` opcional.
 * A resposta é tipada por `MessageResponse<T>`.
 *
 * Contextos:
 *   - service-worker (background/)
 *   - content scripts (content/)
 *   - popup (popup/)
 *   - panel injetado (panel/)
 */

// ── Mensagens de autenticação ──────────────────────────────────────

export interface LoginRequest {
  type: 'AUTH_LOGIN';
  payload: { email: string; password: string };
}

export interface LogoutRequest {
  type: 'AUTH_LOGOUT';
}

export interface GetAuthStateRequest {
  type: 'AUTH_GET_STATE';
}

// ── Mensagens de leads (usadas no painel do WhatsApp) ──────────────

export interface FindLeadByPhoneRequest {
  type: 'LEAD_FIND_BY_PHONE';
  payload: { phone: string };
}

export interface CreateLeadRequest {
  type: 'LEAD_CREATE';
  payload: {
    name: string;
    phone: string;
    whatsapp: string;
    email?: string;
    company?: string;
  };
}

export interface UpdateLeadStageRequest {
  type: 'LEAD_UPDATE_STAGE';
  payload: { leadId: string; stageId: string };
}

export interface ListInteractionsRequest {
  type: 'INTERACTION_LIST';
  payload: { leadId: string };
}

export interface ListStagesRequest {
  type: 'STAGE_LIST';
  payload: { pipelineId: string };
}

export interface RegisterInteractionRequest {
  type: 'INTERACTION_CREATE';
  payload: {
    leadId: string;
    type: Interaction['type'];
    description: string;
  };
}

export interface CreateTaskRequest {
  type: 'TASK_CREATE';
  payload: CreateTaskDTO;
}

export interface FindLeadByIdRequest {
  type: 'LEAD_FIND_BY_ID';
  payload: { leadId: string };
}

export interface SearchLeadsRequest {
  type: 'LEAD_SEARCH';
  payload: { query: string };
}

export interface SearchLeadsByNameRequest {
  type: 'LEAD_SEARCH_BY_NAME';
  payload: { name: string; limit?: number };
}

// ── Mensagens de templates / mensagens agendadas ───────────────────

export interface ListTemplatesRequest {
  type: 'TEMPLATE_LIST';
}

export interface ScheduleMessageRequest {
  type: 'MESSAGE_SCHEDULE';
  payload: {
    leadId: string;
    templateId?: string;
    messageBody: string;
    scheduledAt: string;
  };
}

/**
 * Enviada pelo service worker PARA o content script do WhatsApp
 * quando há uma mensagem agendada pronta para envio.
 */
export interface SendScheduledMessageNotify {
  type: 'MESSAGE_SEND_NOW';
  payload: {
    messageId: string;
    phone: string;
    body: string;
  };
}

// ── Mensagens de anotações por lead (persistência local) ───────────

export interface GetNotesRequest {
  type: 'NOTES_GET';
  payload: { leadId: string };
}

export interface SetNotesRequest {
  type: 'NOTES_SET';
  payload: { leadId: string; text: string };
}

// ── Mensagens de produtos (catálogo + itens por lead) ──────────────

export interface ListCatalogRequest {
  type: 'PRODUCTS_CATALOG';
}

export interface GetLeadProductsRequest {
  type: 'PRODUCTS_GET_FOR_LEAD';
  payload: { leadId: string };
}

export interface SetLeadProductsRequest {
  type: 'PRODUCTS_SET_FOR_LEAD';
  payload: { leadId: string; items: LeadProductInput[] };
}

// ── Mensagens de tarefas por lead (persistência local + alarms) ────
//
// NOTA: prefixo LEAD_TASK_* pra não colidir com TASK_CREATE existente,
// que é o create de task no backend (api.leads.createTask).

export interface ListLeadTasksRequest {
  type: 'LEAD_TASK_LIST';
  payload: { leadId: string };
}

export interface CreateLeadTaskRequest {
  type: 'LEAD_TASK_CREATE';
  payload: {
    leadId: string;
    leadName: string;
    title: string;
    description: string;
    type: LeadTaskType;
    dueAt: string;
  };
}

export interface UpdateLeadTaskRequest {
  type: 'LEAD_TASK_UPDATE';
  payload: {
    leadId: string;
    taskId: string;
    patch: Partial<Pick<LeadTask, 'title' | 'description' | 'type' | 'dueAt'>>;
  };
}

export interface DeleteLeadTaskRequest {
  type: 'LEAD_TASK_DELETE';
  payload: { leadId: string; taskId: string };
}

export interface MarkLeadTaskRequest {
  type: 'LEAD_TASK_MARK';
  payload: { leadId: string; taskId: string; status: LeadTaskStatus };
}

// ── Mensagens de outcome (venda/perda) por lead ───────────────────
//
// LEAD_OUTCOME_SET inclui pipelineId porque o handler tenta resolver
// a stage Vendido/Perdido via api.leads.listStages(pipelineId) e então
// chama updateStage. Falha silenciosa se a stage não existir no mock.

export interface GetLeadOutcomeRequest {
  type: 'LEAD_OUTCOME_GET';
  payload: { leadId: string };
}

export interface SetLeadOutcomeRequest {
  type: 'LEAD_OUTCOME_SET';
  payload: {
    leadId: string;
    pipelineId: string;
    outcome: LeadOutcome;
  };
}

export interface ClearLeadOutcomeRequest {
  type: 'LEAD_OUTCOME_CLEAR';
  payload: { leadId: string };
}

export interface ListLossReasonsRequest {
  type: 'LOSS_REASONS_LIST';
}

// ── Mensagens de telefones alternativos (vinculação local) ─────────
//
// Mapa phone → leadId por usuário, persistido em
// chrome.storage.local com chave lead-alt-phones:{userId}.
// Permite que um lead responda de um celular pessoal não cadastrado
// no CRM e o painel ainda o reconheça.

export interface AltPhoneLinkRequest {
  type: 'ALT_PHONE_LINK';
  payload: { phone: string; leadId: string };
}

export interface AltPhoneUnlinkRequest {
  type: 'ALT_PHONE_UNLINK';
  payload: { phone: string };
}

export interface AltPhoneFindLeadIdRequest {
  type: 'ALT_PHONE_FIND_LEAD_ID';
  payload: { phone: string };
}

// ── Union de todas as mensagens ────────────────────────────────────

export type ExtensionMessage =
  | LoginRequest
  | LogoutRequest
  | GetAuthStateRequest
  | FindLeadByPhoneRequest
  | CreateLeadRequest
  | UpdateLeadStageRequest
  | ListInteractionsRequest
  | ListStagesRequest
  | RegisterInteractionRequest
  | CreateTaskRequest
  | ListTemplatesRequest
  | ScheduleMessageRequest
  | SendScheduledMessageNotify
  | GetNotesRequest
  | SetNotesRequest
  | ListCatalogRequest
  | GetLeadProductsRequest
  | SetLeadProductsRequest
  | ListLeadTasksRequest
  | CreateLeadTaskRequest
  | UpdateLeadTaskRequest
  | DeleteLeadTaskRequest
  | MarkLeadTaskRequest
  | GetLeadOutcomeRequest
  | SetLeadOutcomeRequest
  | ClearLeadOutcomeRequest
  | ListLossReasonsRequest
  | FindLeadByIdRequest
  | SearchLeadsRequest
  | SearchLeadsByNameRequest
  | AltPhoneLinkRequest
  | AltPhoneUnlinkRequest
  | AltPhoneFindLeadIdRequest;

// ── Formato de resposta ────────────────────────────────────────────

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Helpers de tipagem para respostas por tipo de mensagem ────────

export interface MessageResponseMap {
  AUTH_LOGIN: { userId: string; email: string };
  AUTH_LOGOUT: null;
  AUTH_GET_STATE: { isAuthenticated: boolean; email?: string };
  LEAD_FIND_BY_PHONE: Lead | null;
  LEAD_CREATE: Lead;
  LEAD_UPDATE_STAGE: Lead;
  INTERACTION_LIST: Interaction[];
  STAGE_LIST: Stage[];
  INTERACTION_CREATE: Interaction;
  TASK_CREATE: { id: string };
  TEMPLATE_LIST: WhatsAppTemplate[];
  MESSAGE_SCHEDULE: ScheduledMessage;
  MESSAGE_SEND_NOW: null;
  NOTES_GET: string;
  NOTES_SET: null;
  PRODUCTS_CATALOG: Product[];
  PRODUCTS_GET_FOR_LEAD: LeadProduct[];
  PRODUCTS_SET_FOR_LEAD: LeadProduct[];
  LEAD_TASK_LIST: LeadTask[];
  LEAD_TASK_CREATE: LeadTask;
  LEAD_TASK_UPDATE: LeadTask;
  LEAD_TASK_DELETE: null;
  LEAD_TASK_MARK: LeadTask;
  LEAD_OUTCOME_GET: LeadOutcome | null;
  LEAD_OUTCOME_SET: null;
  LEAD_OUTCOME_CLEAR: null;
  LOSS_REASONS_LIST: LossReason[];
  LEAD_FIND_BY_ID: Lead | null;
  LEAD_SEARCH: Lead[];
  LEAD_SEARCH_BY_NAME: Lead[];
  ALT_PHONE_LINK: null;
  ALT_PHONE_UNLINK: null;
  ALT_PHONE_FIND_LEAD_ID: string | null;
}
