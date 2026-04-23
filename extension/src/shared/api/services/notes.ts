/**
 * TODO(backend): quando os endpoints de anotações por lead existirem,
 * dividir em notes.service.ts (real) + mockNotesService em
 * ../../mocks/services.ts, seguindo o padrão de leads/messages.
 *
 * Quando isso acontecer, o filtro por usuário/tenant será feito no
 * backend (via Row Level Security). O userId na chave local vira
 * redundante mas ainda útil como cache em navegadores multi-usuário.
 *
 * Persistência atual: chrome.storage.local com chave
 *   lead-notes:{userId}:{leadId}
 * O userId garante isolamento entre sessões no mesmo navegador.
 */

import { storage } from '@shared/utils/storage';

const KEY = (userId: string, leadId: string) => `lead-notes:${userId}:${leadId}`;

async function getUserId(): Promise<string | null> {
  const auth = await storage.get('auth');
  return auth?.user?.id ?? null;
}

export const notesService = {
  async getNotes(leadId: string): Promise<string> {
    const userId = await getUserId();
    if (!userId) return '';
    const key = KEY(userId, leadId);
    const result = await chrome.storage.local.get(key);
    const value = result[key];
    return typeof value === 'string' ? value : '';
  },

  async setNotes(leadId: string, text: string): Promise<void> {
    const userId = await getUserId();
    if (!userId) return; // sem sessão: falha silenciosa
    await chrome.storage.local.set({ [KEY(userId, leadId)]: text });
  }
};
