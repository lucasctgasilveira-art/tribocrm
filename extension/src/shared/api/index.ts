/**
 * Ponto único de acesso aos serviços.
 *
 * Em qualquer lugar do código use:
 *   import { api } from '@shared/api';
 *   const lead = await api.leads.findByPhone('5521...');
 *
 * Se VITE_USE_MOCKS for 'true', as chamadas vão para os mocks.
 * Caso contrário, vão para os serviços reais (que chamam a API via HTTP).
 */

import { authService } from './auth.service';
import { leadsService } from './leads.service';
import { messagesService } from './messages.service';
import { notesService } from './services/notes';
import { productsService } from './services/products';
import { tasksService } from './services/tasks';
import { outcomeService } from './services/outcome';
import { altPhonesService } from './services/alt-phones';
import { whatsappTasksService } from './services/whatsapp-tasks.service';

import {
  mockAuthService,
  mockLeadsService,
  mockMessagesService,
  mockNotesService,
  mockProductsService,
  mockAltPhonesService,
  mockOutcomeService,
  mockTasksService
} from '@shared/mocks/services';

import { createLogger } from '@shared/utils/logger';

const log = createLogger('api-router');

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

if (USE_MOCKS) {
  log.warn('⚠️ MODO MOCK ATIVO — nenhuma chamada real à API está sendo feita.');
}

export const api = {
  auth: USE_MOCKS ? mockAuthService : authService,
  leads: USE_MOCKS ? mockLeadsService : leadsService,
  messages: USE_MOCKS ? mockMessagesService : messagesService,
  notes: USE_MOCKS ? mockNotesService : notesService,
  products: USE_MOCKS ? mockProductsService : productsService,
  tasks: USE_MOCKS ? mockTasksService : tasksService,
  outcome: USE_MOCKS ? mockOutcomeService : outcomeService,
  altPhones: USE_MOCKS ? mockAltPhonesService : altPhonesService,
  // whatsappTasks não tem mock — fluxo agendado é validado contra backend real.
  whatsappTasks: whatsappTasksService
};
