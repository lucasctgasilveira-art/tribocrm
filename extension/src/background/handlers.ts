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

type HandlerMap = {
  [K in ExtensionMessage['type']]: (
    payload: Extract<ExtensionMessage, { type: K }> extends { payload: infer P } ? P : undefined
  ) => Promise<MessageResponseMap[K]>;
};

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

  // Esta mensagem VAI do service worker PARA o content script.
  // Não tem handler no SW — o handler está no whatsapp.ts.
  MESSAGE_SEND_NOW: async () => null
};
