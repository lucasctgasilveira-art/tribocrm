import { http, ApiHttpError } from '../http';
import type { LeadOutcome, LeadProduct, LossReason } from '@shared/types/extra';

/**
 * Service real (HTTP) pra outcome (venda/perda) de lead.
 *
 * Backend NÃO tem entidade `LeadOutcome` separada — o estado vive nos
 * campos do próprio Lead (status, closedValue, wonAt, lostAt,
 * lossReasonId). Este service reconstrói/persiste o LeadOutcome via
 * PATCH /leads/:id (handler updateLead aceita todos os campos no
 * mesmo body).
 *
 * Endpoints usados:
 *   GET  /leads/:id              → reconstrói outcome do estado do lead
 *   PATCH /leads/:id             → seta/limpa outcome (stageId + campos)
 *   GET  /leads/:id/products     → snapshot de produtos (via api separada)
 *   GET  /leads/loss-reasons     → lista de motivos de perda (com adapter)
 *
 * Limites conhecidos pós-migração (vs versão local):
 *   - reasonCustom: backend não tem campo dedicado. Briefing original
 *     mandava registrar como Interaction; mantemos esse fallback.
 *   - reasonLabel: snapshot do label era preservado localmente; agora
 *     o label vem da lista atual de loss-reasons (não é snapshot).
 *   - recordedAt: tinha semântica "quando o registro foi salvo no
 *     storage local"; agora == wonAt/lostAt (mesma data do
 *     fechamento, não do clique).
 */

interface LeadFromBackend {
  id: string;
  status: 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED';
  closedValue: string | number | null;
  lossReasonId: string | null;
  wonAt: string | null;
  lostAt: string | null;
}

export const outcomeService = {
  async getOutcome(leadId: string): Promise<LeadOutcome | null> {
    try {
      const lead = await http.get<LeadFromBackend>(
        `/leads/${encodeURIComponent(leadId)}`,
      );

      if (!lead) return null;
      if (lead.status !== 'WON' && lead.status !== 'LOST') return null;

      const closedAt = (lead.wonAt ?? lead.lostAt ?? '') as string;

      return {
        leadId,
        kind: lead.status === 'WON' ? 'won' : 'lost',
        amount: lead.closedValue !== null ? Number(lead.closedValue) : null,
        // products vivem em LeadProduct (productsService); Panel busca
        // separado quando precisa exibir. Aqui retornamos vazio porque
        // o backend não armazena snapshot dedicado.
        products: [] as LeadProduct[],
        reasonId: lead.lossReasonId,
        // Label e custom vêm de loss-reasons / interactions; Panel
        // resolve quando renderiza badge/details. Mantemos null aqui
        // pra preservar o tipo LeadOutcome.
        reasonLabel: null,
        reasonCustom: null,
        closedAt,
        recordedAt: closedAt,
      };
    } catch (err) {
      if (err instanceof ApiHttpError && err.status === 404) return null;
      throw err;
    }
  },

  /**
   * Persiste outcome via PATCH /leads/:id. Caller (handler) resolve
   * targetStageId via resolveOutcomeStage(pipelineId, kind) antes de
   * chamar — service não conhece pipeline.
   *
   * Se reasonCustom existir (kind='lost' com motivo livre), registra
   * uma interaction adicional com type=NOTE.
   */
  async setOutcome(
    leadId: string,
    outcome: LeadOutcome,
    targetStageId: string,
  ): Promise<void> {
    const body: Record<string, unknown> = { stageId: targetStageId };

    if (outcome.kind === 'won') {
      if (outcome.amount !== null) body.closedValue = outcome.amount;
      if (outcome.closedAt) body.wonAt = outcome.closedAt;
    } else {
      if (outcome.reasonId) body.lossReasonId = outcome.reasonId;
      if (outcome.closedAt) body.lostAt = outcome.closedAt;
    }

    await http.patch(`/leads/${encodeURIComponent(leadId)}`, body);

    if (outcome.kind === 'lost' && outcome.reasonCustom) {
      await http.post(`/leads/${encodeURIComponent(leadId)}/interactions`, {
        type: 'NOTE',
        content: `Motivo de perda customizado: ${outcome.reasonCustom}`,
      });
    }
  },

  /**
   * Limpa campos de fechamento do lead. NÃO toca stageId — é chamado
   * por syncOutcomeWithStage QUANDO a stage já foi mudada manualmente
   * pra fora de WON/LOST (handler LEAD_UPDATE_STAGE).
   */
  async clearOutcome(leadId: string): Promise<void> {
    await http.patch(`/leads/${encodeURIComponent(leadId)}`, {
      closedValue: null,
      lossReasonId: null,
      wonAt: null,
      lostAt: null,
    });
  },

  async listLossReasons(): Promise<LossReason[]> {
    // Backend retorna { id, name }; tipo client é { id, label }. Adapter.
    const result = await http.get<{ id: string; name: string }[]>(
      '/leads/loss-reasons',
    );
    return result.map((r) => ({ id: r.id, label: r.name }));
  },
};
