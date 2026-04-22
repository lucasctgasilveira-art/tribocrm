/**
 * Wrapper tipado do chrome.storage.local.
 *
 * Por que não usar localStorage?
 *   - localStorage não é acessível no service worker (V3).
 *   - chrome.storage.local é compartilhado entre TODOS os contextos da extensão.
 *   - Suporta até 10MB (vs 5MB do localStorage).
 */

import { createLogger } from './logger';

const log = createLogger('storage');

/**
 * Schema do storage — toda chave que gravamos passa por aqui.
 * Se alguma chave mudar de tipo, o TS quebra no uso.
 */
export interface StorageSchema {
  auth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // timestamp epoch ms
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string;
    };
  } | null;

  // Cache de templates de WhatsApp (revalida a cada 10 min)
  templatesCache: {
    data: unknown[];
    fetchedAt: number;
  } | null;

  // Última sincronização bem-sucedida com a API
  lastSync: number | null;
}

type StorageKey = keyof StorageSchema;

export const storage = {
  async get<K extends StorageKey>(key: K): Promise<StorageSchema[K] | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] as StorageSchema[K]) ?? null;
    } catch (error) {
      log.error('Falha ao ler', key, error);
      return null;
    }
  },

  async set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      log.error('Falha ao gravar', key, error);
      throw error;
    }
  },

  async remove<K extends StorageKey>(key: K): Promise<void> {
    await chrome.storage.local.remove(key);
  },

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  },

  /**
   * Escuta mudanças numa chave específica.
   * Retorna função para cancelar o listener.
   */
  onChange<K extends StorageKey>(
    key: K,
    callback: (newValue: StorageSchema[K] | null) => void
  ): () => void {
    const listener = (
      changes: { [k: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return;
      if (key in changes) {
        callback((changes[key].newValue as StorageSchema[K]) ?? null);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },

  /**
   * Remove TODOS os dados de leads (anotações + produtos) de QUALQUER
   * usuário no navegador. Chamar no logout, ANTES de limpar o
   * authToken, para evitar que dados de uma sessão vazem para outra
   * em navegadores compartilhados.
   *
   * Filtro: prefixos `lead-notes:` e `lead-products:`. As chaves do
   * schema fixo (auth, templatesCache, lastSync) NÃO começam com
   * esses prefixos, então estão protegidas.
   */
  async clearAllLeadData(): Promise<void> {
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(
      (k) => k.startsWith('lead-notes:') || k.startsWith('lead-products:')
    );
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  }
};
