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
