/**
 * Tipos do domínio — espelham a resposta da API do TriboCRM.
 * Se algum campo mudar no backend, atualize aqui PRIMEIRO.
 */

export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';
export type LeadStatus = 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED';
export type StageType = 'NORMAL' | 'WON' | 'LOST' | 'REPESCAGEM';

export interface Pipeline {
  id: string;
  name: string;
}

export interface Stage {
  id: string;
  name: string;
  type: StageType;
  color?: string;
  sortOrder?: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface Lead {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  position?: string | null;
  source?: string | null;
  temperature: LeadTemperature;
  expectedValue?: number | null;
  closedValue?: number | null;
  status: LeadStatus;
  notes?: string | null;
  stage: Stage;
  pipeline: Pipeline;
  responsible: User;
  createdAt: string;
  updatedAt: string;
}

export type InteractionType =
  | 'CALL'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'MEETING'
  | 'NOTE'
  | 'VISIT';

export interface Interaction {
  id: string;
  leadId: string;
  type: InteractionType;
  description: string;
  user: User;
  createdAt: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
}

export type ScheduledMessageStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface ScheduledMessage {
  id: string;
  leadId: string;
  templateId?: string | null;
  messageBody: string;
  scheduledAt: string;
  status: ScheduledMessageStatus;
  sentAt?: string | null;
  failedAt?: string | null;
}

export type TaskType = 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'VISIT';

export interface CreateTaskDTO {
  leadId: string;
  type: TaskType;
  title: string;
  description?: string;
  dueDate: string;
  responsibleId?: string;
}

/**
 * Envelope padrão da API TriboCRM — todos os endpoints retornam este formato.
 * Documentado no 10_Documentacao_da_API.md seção 4.1.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
