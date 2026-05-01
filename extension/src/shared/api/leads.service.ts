import { http, ApiHttpError } from './http';
import type { Lead, CreateTaskDTO, Interaction, Stage } from '@shared/types/domain';

export interface CreateLeadInput {
  name: string;
  phone: string;
  whatsapp: string;
  email?: string;
  company?: string;
  pipelineId?: string;
  stageId?: string;
}

export const leadsService = {
  /**
   * Busca lead por número de telefone (usado pelo painel WhatsApp).
   * Retorna null se não encontrar.
   */
  async findByPhone(phone: string): Promise<Lead | null> {
    try {
      const lead = await http.get<Lead | null>(`/leads/by-phone/${encodeURIComponent(phone)}`);
      return lead;
    } catch (err) {
      // 404 = lead não encontrado → retorna null (não é erro)
      if (err instanceof ApiHttpError && err.status === 404) return null;
      throw err;
    }
  },

  async create(input: CreateLeadInput): Promise<Lead> {
    return http.post<Lead>('/leads', input);
  },

  async updateStage(leadId: string, stageId: string): Promise<Lead> {
    // Backend tem apenas PATCH /leads/:id (updateLead aceita stageId no body).
    // Não existe /leads/:id/stage como rota separada — mantemos a função
    // updateStage por compatibilidade de signature, mas o endpoint é /leads/:id.
    return http.patch<Lead>(`/leads/${leadId}`, { stageId });
  },

  async registerInteraction(
    leadId: string,
    type: Interaction['type'],
    description: string
  ): Promise<Interaction> {
    return http.post<Interaction>(`/leads/${leadId}/interactions`, { type, description });
  },

  async listInteractions(leadId: string): Promise<Interaction[]> {
    return http.get<Interaction[]>(`/leads/${leadId}/interactions`);
  },

  async createTask(dto: CreateTaskDTO): Promise<{ id: string }> {
    return http.post<{ id: string }>('/tasks', dto);
  },

  async listStages(pipelineId: string): Promise<Stage[]> {
    return http.get<Stage[]>(`/pipelines/${pipelineId}/stages`);
  },

  /**
   * Busca lead pelo id. Retorna null em 404 (mesmo padrão de
   * findByPhone) — útil pra resolver entradas órfãs do mapa de
   * telefones alternativos sem quebrar o fluxo.
   */
  async findById(leadId: string): Promise<Lead | null> {
    try {
      const lead = await http.get<Lead | null>(`/leads/${encodeURIComponent(leadId)}`);
      return lead;
    } catch (err) {
      if (err instanceof ApiHttpError && err.status === 404) return null;
      throw err;
    }
  },

  /**
   * TODO(backend): endpoint assumido como GET /leads?q=...&limit=10.
   * Deve retornar match case-insensitive em nome + empresa, até 10
   * resultados, ordenados por updatedAt desc.
   */
  async search(query: string): Promise<Lead[]> {
    return http.get<Lead[]>(`/leads?q=${encodeURIComponent(query)}&limit=10`);
  },

  /**
   * Busca leads cujo nome contenha o termo informado (parcial,
   * case-insensitive). Backend escopa por sellerScope + pipeline access
   * e exclui leads LOST/ARCHIVED. Limite default 5 (configurável).
   *
   * Usado quando o vendedor abre conversa direto no WhatsApp Web e o
   * contato esta salvo na agenda — extensao busca pelo nome do header.
   */
  async searchByName(name: string, limit: number = 5): Promise<Lead[]> {
    return http.get<Lead[]>(`/leads/search-by-name?q=${encodeURIComponent(name)}&limit=${limit}`);
  }
};
