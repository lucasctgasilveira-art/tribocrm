import { http, ApiHttpError } from '../http';

/**
 * Service real (HTTP) pra telefones alternativos por lead.
 * Endpoints backend:
 *   GET  /leads/:id/alt-phones        → { phones: string[] }
 *   PUT  /leads/:id/alt-phones        → body { phones: string[] }
 *   GET  /leads/by-alt-phone/:phone   → { leadId } | null  (lookup reverso)
 *
 * link/unlink são compostas: GET + mutate + PUT. Não são atômicas no
 * backend; se outro cliente alterar a lista entre o GET e o PUT, o PUT
 * sobrescreve com a versão deste cliente. Aceito porque write contention
 * em alt-phones é raro (vendedor mexendo em UM lead por vez).
 *
 * `getMap` (legado, retornava mapa global { phone: leadId }) foi
 * removido — não tinha callers no Panel nem nos handlers.
 */
export const altPhonesService = {
  async findLeadIdByPhone(phone: string): Promise<string | null> {
    try {
      const result = await http.get<{ leadId: string } | null>(
        `/leads/by-alt-phone/${encodeURIComponent(phone)}`
      );
      return result?.leadId ?? null;
    } catch (err) {
      if (err instanceof ApiHttpError && err.status === 404) return null;
      throw err;
    }
  },

  async link(phone: string, leadId: string): Promise<void> {
    const data = await http.get<{ phones: string[] }>(
      `/leads/${encodeURIComponent(leadId)}/alt-phones`
    );
    const current = Array.isArray(data?.phones) ? data.phones : [];
    if (current.includes(phone)) return;
    await http.put<{ phones: string[] }>(
      `/leads/${encodeURIComponent(leadId)}/alt-phones`,
      { phones: [...current, phone] }
    );
  },

  async unlink(phone: string): Promise<void> {
    const leadId = await this.findLeadIdByPhone(phone);
    if (!leadId) return;
    const data = await http.get<{ phones: string[] }>(
      `/leads/${encodeURIComponent(leadId)}/alt-phones`
    );
    const current = Array.isArray(data?.phones) ? data.phones : [];
    const updated = current.filter((p) => p !== phone);
    if (updated.length === current.length) return;
    await http.put<{ phones: string[] }>(
      `/leads/${encodeURIComponent(leadId)}/alt-phones`,
      { phones: updated }
    );
  },
};
