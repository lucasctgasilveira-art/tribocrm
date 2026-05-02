/**
 * Service específico pro fluxo de mensagens WhatsApp agendadas via Tarefa.
 *
 * Diferente de messages.service.ts (rota legacy /scheduled-messages, ainda
 * usado pelo MESSAGE_SCHEDULE handler), este consome as rotas que a Fase 1
 * adicionou em /tasks/* — onde a tarefa É a unidade de agendamento.
 *
 * Endpoints backend:
 *   GET  /tasks/pending-whatsapp     → fila do scheduler
 *   POST /tasks/:id/whatsapp-sent    → confirma envio (também marca isDone=true)
 *   POST /tasks/:id/whatsapp-failed  → falha + cria notificação WHATSAPP_FAILED
 *   PATCH /tasks/:id                 → usado pelo snooze pra mexer dueDate
 */

import { http } from '../http';

export interface PendingWhatsappTask {
  id: string;
  leadId: string;
  title: string;
  dueDate: string;
  whatsappTemplateId: string | null;
  whatsappMessageBody: string;
  sendStatus: string;
  lead?: {
    id: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
  };
}

export const whatsappTasksService = {
  async listPending(): Promise<PendingWhatsappTask[]> {
    const result = await http.get<PendingWhatsappTask[]>('/tasks/pending-whatsapp');
    return Array.isArray(result) ? result : [];
  },

  async markSent(taskId: string): Promise<void> {
    await http.post(`/tasks/${encodeURIComponent(taskId)}/whatsapp-sent`, {});
  },

  async markFailed(taskId: string, errorMessage?: string): Promise<void> {
    await http.post(`/tasks/${encodeURIComponent(taskId)}/whatsapp-failed`, {
      errorMessage: errorMessage ?? 'Falha não especificada'
    });
  },

  /**
   * Adia a tarefa em N minutos atualizando dueDate. O scheduler vai
   * achar de novo no próximo ciclo após o novo horário, e a flag local
   * de "já notifiquei" deve ser resetada pelo caller.
   */
  async snooze(taskId: string, minutes: number): Promise<void> {
    const newDue = new Date(Date.now() + minutes * 60_000).toISOString();
    await http.patch(`/tasks/${encodeURIComponent(taskId)}`, { dueDate: newDue });
  }
};
