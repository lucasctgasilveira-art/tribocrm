/**
 * Cache local de mapeamento "nome do contato no WhatsApp" → "leadId no CRM".
 *
 * Usado quando o vendedor abre uma conversa direto no WhatsApp Web e o
 * contato esta salvo na agenda (numero escondido). A primeira vez, a
 * extensao busca leads pelo nome no backend; se houver mais de 1 match
 * o vendedor escolhe na lista, e a escolha fica gravada aqui pra que da
 * proxima vez a identificacao seja automatica e instantanea (sem precisar
 * pesquisar de novo).
 *
 * Storage: chrome.storage.local key 'name-to-lead-map'
 * Formato: { "<nome normalizado>": "<leadId>", ... }
 *
 * Normalizacao do nome:
 *   - trim
 *   - lowercase
 *   - remove acentos (NFD + remove combining marks)
 *   - colapsa multiplos espacos em 1
 *
 * Sem TTL: o mapeamento persiste ate o vendedor mudar de explicito
 * (via "voltar" no painel) ou desinstalar a extensao.
 */

const STORAGE_KEY = 'name-to-lead-map';

export function normalizeName(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

type NameMap = Record<string, string>;

async function readMap(): Promise<NameMap> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        const map = data?.[STORAGE_KEY];
        resolve(map && typeof map === 'object' ? (map as NameMap) : {});
      });
    } catch {
      resolve({});
    }
  });
}

async function writeMap(map: NameMap): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: map }, () => resolve());
    } catch {
      resolve();
    }
  });
}

/**
 * Lê o leadId mapeado pra um nome. Retorna null se não encontrar.
 */
export async function getMappedLeadId(name: string): Promise<string | null> {
  const key = normalizeName(name);
  if (!key) return null;
  const map = await readMap();
  return map[key] ?? null;
}

/**
 * Grava (ou substitui) o vínculo nome → leadId.
 */
export async function setMappedLeadId(name: string, leadId: string): Promise<void> {
  const key = normalizeName(name);
  if (!key || !leadId) return;
  const map = await readMap();
  map[key] = leadId;
  await writeMap(map);
}

/**
 * Remove o vínculo de um nome — usado pelo botão "← voltar" quando
 * o vendedor percebe que escolheu o lead errado.
 */
export async function clearMappedLeadId(name: string): Promise<void> {
  const key = normalizeName(name);
  if (!key) return;
  const map = await readMap();
  if (key in map) {
    delete map[key];
    await writeMap(map);
  }
}
