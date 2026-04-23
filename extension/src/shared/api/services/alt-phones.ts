/**
 * TODO(backend): quando existir endpoint pra telefones alternativos
 * por lead (ex.: POST /leads/:id/phones + GET /leads/by-phone/:phone
 * já respeitando alt phones), dividir em alt-phones.service.ts (real)
 * + mockAltPhonesService em ../../mocks/services.ts, seguindo o padrão
 * de leads/messages.
 *
 * Quando isso acontecer, o filtro por usuário/tenant será feito no
 * backend (via Row Level Security). O userId na chave local vira
 * redundante mas ainda útil como cache em navegadores multi-usuário.
 *
 * Persistência atual: chrome.storage.local com chave
 *   lead-alt-phones:{userId}   (singular — 1 registro por usuário)
 * O valor é um mapa { [phone]: leadId }. Um telefone só pode apontar
 * pra um lead — re-atribuição sobrescreve silenciosamente (a UI garante
 * confirmação inline antes de chamar link()).
 */

import { storage } from '@shared/utils/storage';
import { normalizePhone } from '@shared/utils/phone';

type AltPhoneMap = Record<string, string>;

const KEY = (userId: string) => `lead-alt-phones:${userId}`;

async function getUserId(): Promise<string | null> {
  const auth = await storage.get('auth');
  return auth?.user?.id ?? null;
}

async function readMap(userId: string): Promise<AltPhoneMap> {
  const key = KEY(userId);
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return value && typeof value === 'object' ? (value as AltPhoneMap) : {};
}

export const altPhonesService = {
  async getMap(): Promise<AltPhoneMap> {
    const userId = await getUserId();
    if (!userId) return {};
    return readMap(userId);
  },

  async link(phone: string, leadId: string): Promise<void> {
    const userId = await getUserId();
    if (!userId) return; // sem sessão: falha silenciosa
    const normalized = normalizePhone(phone) ?? phone;
    const map = await readMap(userId);
    map[normalized] = leadId;
    await chrome.storage.local.set({ [KEY(userId)]: map });
  },

  async unlink(phone: string): Promise<void> {
    const userId = await getUserId();
    if (!userId) return;
    const normalized = normalizePhone(phone) ?? phone;
    const map = await readMap(userId);
    if (!(normalized in map)) return;
    delete map[normalized];
    await chrome.storage.local.set({ [KEY(userId)]: map });
  },

  async findLeadIdByPhone(phone: string): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return null;
    const normalized = normalizePhone(phone) ?? phone;
    const map = await readMap(userId);
    return map[normalized] ?? null;
  }
};
