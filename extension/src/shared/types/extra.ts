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
