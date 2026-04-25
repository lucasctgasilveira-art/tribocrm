/**
 * Implementações mock dos serviços.
 *
 * IMPORTANTE: mantenha a mesma ASSINATURA dos serviços reais em leads.service.ts,
 * messages.service.ts e auth.service.ts. O roteador em ./index.ts depende disso.
 */

import type { Lead, Interaction, WhatsAppTemplate, ScheduledMessage } from '@shared/types/domain';
import type { LeadProduct, LeadProductInput, Product, LeadOutcome, LossReason, LeadTask, LeadTaskStatus } from '@shared/types/extra';
import type { CreateLeadInput } from '../api/leads.service';
import type { ScheduleMessageInput } from '../api/messages.service';
import { MOCK_LEADS, MOCK_INTERACTIONS, MOCK_TEMPLATES, MOCK_STAGES } from './fixtures';
import { CATALOG_PRODUCTS } from './catalog';
import { LOSS_REASONS } from './loss-reasons';
import { storage } from '@shared/utils/storage';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Normaliza pra busca: remove acentos (NFD + faixa combining) e
 * baixa pra minúsculas. Usuários digitam sem acento, então "maria"
 * casa com "María".
 */
function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Estado mutável em memória (sobrevive enquanto o service worker estiver vivo)
const leadsDb = [...MOCK_LEADS];
const interactionsDb = [...MOCK_INTERACTIONS];
const scheduledDb: ScheduledMessage[] = [];

// ── Auth mock ────────────────────────────────────────────────────

export const mockAuthService = {
  async login(email: string, _password: string) {
    await delay(400);
    const user = {
      id: 'user-vendedor-1',
      email,
      name: 'Pedro Gomes',
      tenantId: 'tenant-demo'
    };
    await storage.set('auth', {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      user
    });
    return user;
  },

  async logout() {
    await delay(200);
    await storage.set('auth', null);
  },

  async getCurrentUser() {
    const auth = await storage.get('auth');
    return auth?.user ?? null;
  },

  async isAuthenticated() {
    const auth = await storage.get('auth');
    return auth !== null;
  }
};

// ── Leads mock ───────────────────────────────────────────────────

export const mockLeadsService = {
  async findByPhone(phone: string): Promise<Lead | null> {
    await delay(300);
    return leadsDb.find((l) => l.phone === phone || l.whatsapp === phone) ?? null;
  },

  async create(input: CreateLeadInput): Promise<Lead> {
    await delay(400);
    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name: input.name,
      company: input.company ?? null,
      email: input.email ?? null,
      phone: input.phone,
      whatsapp: input.whatsapp,
      position: null,
      source: 'Extensão WhatsApp',
      temperature: 'WARM',
      expectedValue: null,
      closedValue: null,
      status: 'ACTIVE',
      notes: null,
      stage: MOCK_STAGES[0],
      pipeline: { id: 'pipe-1', name: 'Pipeline Principal' },
      responsible: { id: 'user-vendedor-1', name: 'Pedro Gomes' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    leadsDb.push(newLead);
    return newLead;
  },

  async updateStage(leadId: string, stageId: string): Promise<Lead> {
    await delay(250);
    const lead = leadsDb.find((l) => l.id === leadId);
    const stage = MOCK_STAGES.find((s) => s.id === stageId);
    if (!lead || !stage) throw new Error('Lead ou etapa não encontrado');
    lead.stage = stage;
    lead.updatedAt = new Date().toISOString();
    return lead;
  },

  async registerInteraction(
    leadId: string,
    type: Interaction['type'],
    description: string
  ): Promise<Interaction> {
    await delay(250);
    const newInteraction: Interaction = {
      id: `int-${Date.now()}`,
      leadId,
      type,
      description,
      user: { id: 'user-vendedor-1', name: 'Pedro Gomes' },
      createdAt: new Date().toISOString()
    };
    interactionsDb.push(newInteraction);
    return newInteraction;
  },

  async createTask(_dto: { leadId: string; type: string; title: string; dueDate: string }) {
    await delay(250);
    return { id: `task-${Date.now()}` };
  },

  // Endpoint extra útil pro mock (não existe no service real):
  async listInteractions(leadId: string): Promise<Interaction[]> {
    await delay(200);
    return interactionsDb
      .filter((i) => i.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listStages(_pipelineId: string) {
    await delay(150);
    return MOCK_STAGES;
  },

  async findById(leadId: string): Promise<Lead | null> {
    await delay(150);
    return leadsDb.find((l) => l.id === leadId) ?? null;
  },

  /**
   * Busca em nome + empresa. Até 10 resultados.
   *
   * Ordenação: updatedAt desc. Se QUALQUER item do resultado não
   * tiver updatedAt (fixture parcial/futura), cai em alfabético por
   * nome — evita que um único registro sem campo embaralhe a lista
   * com string vazia no topo.
   */
  async search(query: string): Promise<Lead[]> {
    await delay(200);
    const q = normalizeForSearch(query.trim());
    if (q.length < 2) return [];

    const matches = leadsDb.filter((l) => {
      const name = normalizeForSearch(l.name);
      const company = normalizeForSearch(l.company ?? '');
      return name.includes(q) || company.includes(q);
    });

    const allHaveUpdated = matches.every(
      (l) => typeof l.updatedAt === 'string' && l.updatedAt !== ''
    );
    matches.sort((a, b) =>
      allHaveUpdated
        ? b.updatedAt.localeCompare(a.updatedAt)
        : a.name.localeCompare(b.name)
    );

    return matches.slice(0, 10);
  }
};

// ── Messages mock ────────────────────────────────────────────────

export const mockMessagesService = {
  async listTemplates(): Promise<WhatsAppTemplate[]> {
    await delay(200);
    return MOCK_TEMPLATES;
  },

  async schedule(input: ScheduleMessageInput): Promise<ScheduledMessage> {
    await delay(300);
    const msg: ScheduledMessage = {
      id: `sch-${Date.now()}`,
      leadId: input.leadId,
      templateId: input.templateId ?? null,
      messageBody: input.messageBody,
      scheduledAt: input.scheduledAt,
      status: 'PENDING'
    };
    scheduledDb.push(msg);
    return msg;
  },

  async listPending() {
    return scheduledDb.filter((m) => m.status === 'PENDING');
  },

  async markSent(messageId: string) {
    const m = scheduledDb.find((x) => x.id === messageId);
    if (m) {
      m.status = 'SENT';
      m.sentAt = new Date().toISOString();
    }
  },

  async markFailed(messageId: string) {
    const m = scheduledDb.find((x) => x.id === messageId);
    if (m) {
      m.status = 'FAILED';
      m.failedAt = new Date().toISOString();
    }
  }
};

// ── Notes mock ───────────────────────────────────────────────────

// State em memória pra simular nota por leadId. Mantém a interface
// compatível com a do service real (string in / string out).
const mockNotesDb = new Map<string, string>();

export const mockNotesService = {
  async getNotes(leadId: string): Promise<string> {
    await delay(150);
    return mockNotesDb.get(leadId) ?? '';
  },

  async setNotes(leadId: string, text: string): Promise<void> {
    await delay(200);
    mockNotesDb.set(leadId, text);
  },
};

// ── AltPhones mock ───────────────────────────────────────────────

// State em memória: por lead a lista de phones, e um mapa reverso
// pro lookup findLeadIdByPhone. Mantidos em sync nas mutations.
const mockAltPhonesByLead = new Map<string, string[]>();
const mockLeadByAltPhone = new Map<string, string>();

export const mockAltPhonesService = {
  async findLeadIdByPhone(phone: string): Promise<string | null> {
    await delay(120);
    return mockLeadByAltPhone.get(phone) ?? null;
  },

  async link(phone: string, leadId: string): Promise<void> {
    await delay(180);
    const current = mockAltPhonesByLead.get(leadId) ?? [];
    if (current.includes(phone)) return;
    mockAltPhonesByLead.set(leadId, [...current, phone]);
    mockLeadByAltPhone.set(phone, leadId);
  },

  async unlink(phone: string): Promise<void> {
    await delay(180);
    const leadId = mockLeadByAltPhone.get(phone);
    if (!leadId) return;
    const current = mockAltPhonesByLead.get(leadId) ?? [];
    const updated = current.filter((p) => p !== phone);
    if (updated.length === 0) {
      mockAltPhonesByLead.delete(leadId);
    } else {
      mockAltPhonesByLead.set(leadId, updated);
    }
    mockLeadByAltPhone.delete(phone);
  },
};

// ── Products mock ────────────────────────────────────────────────

// State em memória pra simular leadProducts por leadId
const mockLeadProductsDb = new Map<string, LeadProduct[]>();

const round2 = (n: number) => Math.round(n * 100) / 100;

const buildLeadProduct = (
  input: LeadProductInput,
  catalog: Product
): LeadProduct => {
  const unitPrice = catalog.price;
  const quantity = input.quantity;
  const discountPercent = input.discountPercent ?? null;
  const finalPrice = round2(
    unitPrice * quantity * (1 - (discountPercent ?? 0) / 100)
  );
  return {
    id: `mock-lp-${Math.random().toString(36).slice(2, 10)}`,
    productId: input.productId,
    quantity,
    unitPrice,
    discountPercent,
    finalPrice,
    createdAt: new Date().toISOString(),
    product: {
      id: catalog.id,
      name: catalog.name,
      category: catalog.category,
    },
  };
};

export const mockProductsService = {
  async listCatalog(): Promise<Product[]> {
    return CATALOG_PRODUCTS.filter(p => p.isActive);
  },

  async getLeadProducts(leadId: string): Promise<LeadProduct[]> {
    return mockLeadProductsDb.get(leadId) ?? [];
  },

  async setLeadProducts(
    leadId: string,
    items: LeadProductInput[]
  ): Promise<LeadProduct[]> {
    const result: LeadProduct[] = [];
    for (const input of items) {
      const catalog = CATALOG_PRODUCTS.find(p => p.id === input.productId);
      if (!catalog) {
        throw new Error(`mock: produto ${input.productId} nao existe`);
      }
      result.push(buildLeadProduct(input, catalog));
    }
    mockLeadProductsDb.set(leadId, result);
    return result;
  },
};

// ── Outcome mock ─────────────────────────────────────────────────

// State em memória pra outcome por leadId. Aceita o targetStageId
// só pra paridade com a signature do service real — mock ignora,
// porque não simula pipeline/stage backend.
const mockOutcomesDb = new Map<string, LeadOutcome>();

export const mockOutcomeService = {
  async getOutcome(leadId: string): Promise<LeadOutcome | null> {
    await delay(120);
    return mockOutcomesDb.get(leadId) ?? null;
  },

  async setOutcome(
    leadId: string,
    outcome: LeadOutcome,
    _targetStageId: string,
  ): Promise<void> {
    await delay(180);
    mockOutcomesDb.set(leadId, outcome);
  },

  async clearOutcome(leadId: string): Promise<void> {
    await delay(120);
    mockOutcomesDb.delete(leadId);
  },

  async listLossReasons(): Promise<LossReason[]> {
    await delay(80);
    return LOSS_REASONS;
  },
};

// ── Tasks mock ────────────────────────────────────────────────────

// State em memória: por lead a lista de LeadTask. IDs são strings
// "mock-task-{ts}-{n}" pra simular o id do backend.
const mockTasksDb = new Map<string, LeadTask[]>();
let mockTaskCounter = 0;

function findTaskInMockDb(
  taskId: string,
): { leadId: string; idx: number; list: LeadTask[] } | null {
  for (const [leadId, list] of mockTasksDb.entries()) {
    const idx = list.findIndex((t) => t.id === taskId);
    if (idx >= 0) return { leadId, idx, list };
  }
  return null;
}

export const mockTasksService = {
  async listTasks(leadId: string): Promise<LeadTask[]> {
    await delay(120);
    return mockTasksDb.get(leadId) ?? [];
  },

  async addTask(leadId: string, task: LeadTask): Promise<LeadTask> {
    await delay(180);
    const newTask: LeadTask = {
      ...task,
      id: `mock-task-${Date.now()}-${++mockTaskCounter}`,
    };
    const list = mockTasksDb.get(leadId) ?? [];
    mockTasksDb.set(leadId, [...list, newTask]);
    return newTask;
  },

  async updateTask(
    leadId: string,
    taskId: string,
    patch: Partial<LeadTask>,
  ): Promise<LeadTask> {
    await delay(150);
    const list = mockTasksDb.get(leadId) ?? [];
    const idx = list.findIndex((t) => t.id === taskId);
    if (idx < 0) throw new Error('Tarefa não encontrada');
    const updated: LeadTask = { ...list[idx], ...patch, id: list[idx].id };
    const next = [...list];
    next[idx] = updated;
    mockTasksDb.set(leadId, next);
    return updated;
  },

  async deleteTask(leadId: string, taskId: string): Promise<void> {
    await delay(120);
    const list = mockTasksDb.get(leadId) ?? [];
    const next = list.filter((t) => t.id !== taskId);
    if (next.length !== list.length) mockTasksDb.set(leadId, next);
  },

  async markStatus(
    leadId: string,
    taskId: string,
    status: LeadTaskStatus,
  ): Promise<LeadTask> {
    const completedAt = status === 'done' ? new Date().toISOString() : null;
    return this.updateTask(leadId, taskId, { status, completedAt });
  },

  async findTaskGlobally(taskId: string): Promise<LeadTask | null> {
    await delay(80);
    const found = findTaskInMockDb(taskId);
    return found ? found.list[found.idx] : null;
  },

  async markNotifiedIfPending(taskId: string): Promise<LeadTask | null> {
    await delay(80);
    const found = findTaskInMockDb(taskId);
    if (!found) return null;
    const task = found.list[found.idx];
    if (task.status !== 'pending' || task.notified) return null;
    const updated: LeadTask = { ...task, notified: true };
    const next = [...found.list];
    next[found.idx] = updated;
    mockTasksDb.set(found.leadId, next);
    return updated;
  },
};
