/**
 * Tipos auxiliares de domínio que ainda não existem no backend.
 * Quando o backend suportar, mover para domain.ts e ajustar shape.
 */

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
}

export interface LeadProduct {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// ── Tarefas por lead (persistência local) ─────────────────────────

export type LeadTaskType = 'call' | 'visit' | 'meeting' | 'email' | 'other';
export type LeadTaskStatus = 'pending' | 'done';

export interface LeadTask {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  description: string;
  type: LeadTaskType;
  dueAt: string;
  status: LeadTaskStatus;
  createdAt: string;
  completedAt: string | null;
  notified: boolean;
}

// ── Outcome: vender/perder (persistência local) ───────────────────

export interface LossReason {
  id: string;
  label: string;
}

export type LeadOutcomeKind = 'won' | 'lost';

export interface LeadOutcome {
  leadId: string;
  kind: LeadOutcomeKind;

  // Campos de venda
  amount: number | null;
  products: LeadProduct[];        // snapshot imutável na hora da venda

  // Campos de perda
  reasonId: string | null;
  reasonLabel: string | null;     // label snapshot — se mudar no backend, histórico preservado
  reasonCustom: string | null;    // texto livre quando reasonId === 'other'

  // Comuns
  closedAt: string;               // ISO — data escolhida no form (meia-noite local)
  recordedAt: string;             // ISO — momento exato do registro
}
