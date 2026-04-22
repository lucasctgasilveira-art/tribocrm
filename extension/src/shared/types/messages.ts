import type {
  Lead,
  Interaction,
  WhatsAppTemplate,
  ScheduledMessage,
  CreateTaskDTO,
  Stage
} from './domain';
import type { Product, LeadProduct } from './extra';

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
  payload: { leadId: string; items: LeadProduct[] };
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
  | SetLeadProductsRequest;

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
  PRODUCTS_SET_FOR_LEAD: null;
}
