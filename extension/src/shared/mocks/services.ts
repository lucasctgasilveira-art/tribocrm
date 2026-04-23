/**
 * Implementações mock dos serviços.
 *
 * IMPORTANTE: mantenha a mesma ASSINATURA dos serviços reais em leads.service.ts,
 * messages.service.ts e auth.service.ts. O roteador em ./index.ts depende disso.
 */

import type { Lead, Interaction, WhatsAppTemplate, ScheduledMessage } from '@shared/types/domain';
import type { CreateLeadInput } from '../api/leads.service';
import type { ScheduleMessageInput } from '../api/messages.service';
import { MOCK_LEADS, MOCK_INTERACTIONS, MOCK_TEMPLATES, MOCK_STAGES } from './fixtures';
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
