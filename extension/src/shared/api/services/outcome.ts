/**
 * TODO(backend): quando existirem endpoints de outcome por lead
 * (venda/perda), dividir em outcome.service.ts (real) +
 * mockOutcomeService em ../../mocks/services.ts, seguindo o padrão
 * de leads/messages.
 *
 * Quando isso acontecer, o filtro por usuário/tenant será feito no
 * backend (via Row Level Security). O userId na chave local vira
 * redundante mas ainda útil como cache em navegadores multi-usuário.
 *
 * Persistência atual: chrome.storage.local com chave
 *   lead-outcome:{userId}:{leadId}
 * O userId garante isolamento entre sessões no mesmo navegador.
 *
 * listLossReasons também vira GET no backend — por enquanto lê da
 * fixture LOSS_REASONS. Mantido async para preservar a assinatura
 * quando trocarmos por HTTP.
 */

import type { LeadOutcome, LossReason } from '@shared/types/extra';
import { LOSS_REASONS } from '@shared/mocks/loss-reasons';
import { storage } from '@shared/utils/storage';

const KEY = (userId: string, leadId: string) => `lead-outcome:${userId}:${leadId}`;

async function getUserId(): Promise<string | null> {
  const auth = await storage.get('auth');
  return auth?.user?.id ?? null;
}

export const outcomeService = {
  async getOutcome(leadId: string): Promise<LeadOutcome | null> {
    const userId = await getUserId();
    if (!userId) return null;
    const key = KEY(userId, leadId);
    const result = await chrome.storage.local.get(key);
    const value = result[key];
    return value && typeof value === 'object' ? (value as LeadOutcome) : null;
  },

  async setOutcome(leadId: string, outcome: LeadOutcome): Promise<void> {
    const userId = await getUserId();
    if (!userId) return; // sem sessão: falha silenciosa
    await chrome.storage.local.set({ [KEY(userId, leadId)]: outcome });
  },

  async clearOutcome(leadId: string): Promise<void> {
    const userId = await getUserId();
    if (!userId) return;
    await chrome.storage.local.remove(KEY(userId, leadId));
  },

  async listLossReasons(): Promise<LossReason[]> {
    return LOSS_REASONS;
  }
};
