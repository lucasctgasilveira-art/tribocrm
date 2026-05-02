import api from './api'

export interface TasksParams {
  leadId?: string
  type?: string
  status?: string
  dueDate?: string
  page?: number
  perPage?: number
}

export interface TaskPayload {
  leadId: string
  type: string
  title: string
  description?: string
  dueDate?: string
  responsibleId?: string
  // Campos da Fase 1 (mensagem WhatsApp agendada via Tarefa).
  // Quando type='WHATSAPP' + dueDate + (whatsappTemplateId OU whatsappMessageBody),
  // o backend grava sendStatus='PENDING' e a extensão passa a notificar.
  whatsappTemplateId?: string
  whatsappMessageBody?: string
  reminderMinutes?: number
}

export interface ManagerialTaskPayload {
  title: string
  typeId: string
  description?: string
  dueDate?: string
  participantIds?: string[]
}

export async function getTasks(params?: TasksParams) {
  const response = await api.get('/tasks', { params })
  return { data: response.data.data, meta: response.data.meta }
}

export async function createTask(payload: TaskPayload) {
  const response = await api.post('/tasks', payload)
  return response.data.data
}

export async function completeTask(id: string) {
  const response = await api.patch(`/tasks/${id}/complete`)
  return response.data.data
}

export async function updateTask(id: string, payload: Partial<TaskPayload>) {
  const response = await api.patch(`/tasks/${id}`, payload)
  return response.data.data
}

export async function deleteTask(id: string) {
  const response = await api.delete(`/tasks/${id}`)
  return response.data.data
}

export async function getManagerialTasks(params?: { page?: number; perPage?: number }) {
  const response = await api.get('/tasks/managerial', { params })
  return { data: response.data.data, meta: response.data.meta }
}

export async function createManagerialTask(payload: ManagerialTaskPayload) {
  const response = await api.post('/tasks/managerial', payload)
  return response.data.data
}

export async function completeManagerialTask(id: string) {
  const response = await api.patch(`/tasks/managerial/${id}/complete`)
  return response.data.data
}

export async function updateManagerialTask(id: string, payload: { title?: string; description?: string | null; dueDate?: string | null }) {
  const response = await api.patch(`/tasks/managerial/${id}`, payload)
  return response.data.data
}

export default {
  getTasks, createTask, completeTask, updateTask, deleteTask,
  getManagerialTasks, createManagerialTask, updateManagerialTask, completeManagerialTask,
}
