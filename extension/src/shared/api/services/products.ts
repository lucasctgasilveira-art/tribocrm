/**
 * TODO(backend): quando os endpoints de produtos por lead existirem,
 * dividir em products.service.ts (real) + mockProductsService em
 * ../../mocks/services.ts, seguindo o padrão de leads/messages.
 *
 * Quando isso acontecer, o filtro por usuário/tenant será feito no
 * backend (via Row Level Security). O userId na chave local vira
 * redundante mas ainda útil como cache em navegadores multi-usuário.
 *
 * Persistência atual: chrome.storage.local com chave
 *   lead-products:{userId}:{leadId}
 * O userId garante isolamento entre sessões no mesmo navegador.
 */

import type { Product, LeadProduct } from '@shared/types/extra';
import { CATALOG_PRODUCTS } from '@shared/mocks/catalog';
import { storage } from '@shared/utils/storage';

const KEY = (userId: string, leadId: string) => `lead-products:${userId}:${leadId}`;

async function getUserId(): Promise<string | null> {
  const auth = await storage.get('auth');
  return auth?.user?.id ?? null;
}

export const productsService = {
  async listCatalog(): Promise<Product[]> {
    return CATALOG_PRODUCTS;
  },

  async getLeadProducts(leadId: string): Promise<LeadProduct[]> {
    const userId = await getUserId();
    if (!userId) return [];
    const key = KEY(userId, leadId);
    const result = await chrome.storage.local.get(key);
    const value = result[key];
    return Array.isArray(value) ? (value as LeadProduct[]) : [];
  },

  async setLeadProducts(leadId: string, items: LeadProduct[]): Promise<void> {
    const userId = await getUserId();
    if (!userId) return; // sem sessão: falha silenciosa
    await chrome.storage.local.set({ [KEY(userId, leadId)]: items });
  }
};
