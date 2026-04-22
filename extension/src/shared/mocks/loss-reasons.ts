/**
 * Motivos de perda de lead — mock provisório.
 *
 * TODO(backend): quando existir endpoint /loss-reasons, mover este array
 * para a fixture do mock e passar a ler via api.outcome.listLossReasons()
 * que chamará o endpoint real. A chave `id` tem que permanecer estável:
 * os outcomes gravados guardam `reasonId` + snapshot de `reasonLabel` para
 * preservar histórico quando o label mudar no backend.
 */

import type { LossReason } from '@shared/types/extra';

export const LOSS_REASONS: LossReason[] = [
  { id: 'no-budget', label: 'Sem orçamento' },
  { id: 'competitor', label: 'Comprou do concorrente' },
  { id: 'no-response', label: 'Não respondeu mais' },
  { id: 'bad-timing', label: 'Timing ruim' },
  { id: 'wrong-decision-maker', label: 'Não era decisor certo' },
  { id: 'free-solution', label: 'Encontrou solução gratuita/interna' },
  { id: 'other', label: 'Outro' }
];
