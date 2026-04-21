import { http } from './http';
import type { WhatsAppTemplate, ScheduledMessage } from '@shared/types/domain';

export interface ScheduleMessageInput {
  leadId: string;
  templateId?: string;
  messageBody: string;
  scheduledAt: string;
}

export const messagesService = {
  async listTemplates(): Promise<WhatsAppTemplate[]> {
    return http.get<WhatsAppTemplate[]>('/templates/whatsapp');
  },

  async schedule(input: ScheduleMessageInput): Promise<ScheduledMessage> {
    return http.post<ScheduledMessage>('/scheduled-messages', input);
  },

  async listPending(): Promise<ScheduledMessage[]> {
    return http.get<ScheduledMessage[]>('/scheduled-messages', { status: 'PENDING' });
  },

  async markSent(messageId: string): Promise<void> {
    await http.patch(`/scheduled-messages/${messageId}`, { status: 'SENT' });
  },

  async markFailed(messageId: string): Promise<void> {
    await http.patch(`/scheduled-messages/${messageId}`, { status: 'FAILED' });
  }
};
