import { http, ApiHttpError } from '../http';

/**
 * Service real (HTTP) pra anotação livre por lead.
 * Endpoints backend:
 *   GET  /leads/:id/note   → { content: string }
 *   PUT  /leads/:id/note   → body { content: string }
 *
 * A "nota" é um campo escalar do Lead (Lead.notes), não uma entidade
 * separada — por isso a interface mantém o shape `string` aqui (em vez
 * de objeto Note), pra não exigir refactor de handlers/messages/Panel.
 */
export const notesService = {
  async getNotes(leadId: string): Promise<string> {
    try {
      const data = await http.get<{ content: string }>(
        `/leads/${encodeURIComponent(leadId)}/note`
      );
      return data.content;
    } catch (err) {
      // 404 = lead não encontrado → retorna vazio (compatível com o
      // comportamento antigo de chrome.storage.local quando não havia
      // entrada gravada).
      if (err instanceof ApiHttpError && err.status === 404) return '';
      throw err;
    }
  },

  async setNotes(leadId: string, text: string): Promise<void> {
    await http.put<{ content: string }>(
      `/leads/${encodeURIComponent(leadId)}/note`,
      { content: text }
    );
  },
};
