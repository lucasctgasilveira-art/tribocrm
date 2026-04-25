import { http } from '../http';
import type { Product, LeadProduct, LeadProductInput } from '@shared/types/extra';

/**
 * Service real (HTTP) pra catálogo + produtos do lead.
 * Endpoints backend:
 *   GET  /products                  → catálogo (filtra ativo via ?isActive=true)
 *   GET  /leads/:id/products        → produtos do lead (com total)
 *   PUT  /leads/:id/products        → replace transactional do array
 */
export const productsService = {
  async listCatalog(): Promise<Product[]> {
    return http.get<Product[]>('/products?isActive=true');
  },

  async getLeadProducts(leadId: string): Promise<LeadProduct[]> {
    const data = await http.get<{ items: LeadProduct[]; total: number }>(
      `/leads/${encodeURIComponent(leadId)}/products`
    );
    return data.items;
  },

  async setLeadProducts(
    leadId: string,
    items: LeadProductInput[]
  ): Promise<LeadProduct[]> {
    const data = await http.put<{ items: LeadProduct[]; total: number }>(
      `/leads/${encodeURIComponent(leadId)}/products`,
      { items }
    );
    return data.items;
  },
};
