import { http } from '../http';
import type { LeadTask, LeadTaskType, LeadTaskStatus } from '@shared/types/extra';

/**
 * Service real (HTTP) pra tasks por lead.
 * Endpoints backend (E3-A trouxe isDone no PATCH):
 *   GET    /tasks?leadId=X
 *   POST   /tasks               body: { leadId, type, title, description?, dueDate?, responsibleId? }
 *   PATCH  /tasks/:id           body: { title?, description?, dueDate?, type?, isDone?, responsibleId? }
 *   PATCH  /tasks/:id/complete  (legacy semantic — preservado, não usado aqui)
 *   DELETE /tasks/:id
 *
 * Adapters cliente↔backend:
 *   dueAt        ↔ dueDate
 *   status       ↔ isDone (boolean)
 *   completedAt  ↔ doneAt
 *   type         ↔ type (lower↔UPPER)
 *   leadName     ← lead.name (do include do backend); snapshot é vivo,
 *                  não imutável como na versão local
 *
 * notified (flag local de "alarm já tocou pra essa task") fica em
 * chrome.storage.local com chave separada `task-notified:{taskId}`,
 * porque o backend não tem esse campo. SW (alarms) lê/grava essa flag
 * via getNotifiedFlag/setNotifiedFlag.
 */

interface BackendTask {
  id: string;
  leadId: string;
  type: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'VISIT';
  title: string;
  description: string | null;
  dueDate: string | null;
  isDone: boolean;
  doneAt: string | null;
  createdAt: string;
  updatedAt?: string;
  lead?: { id: string; name: string; company?: string | null };
}

const NOTIFIED_KEY = (taskId: string) => `task-notified:${taskId}`;

async function getNotifiedFlag(taskId: string): Promise<boolean> {
  const result = await chrome.storage.local.get(NOTIFIED_KEY(taskId));
  return Boolean(result[NOTIFIED_KEY(taskId)]);
}

async function setNotifiedFlag(taskId: string, value: boolean): Promise<void> {
  if (value) {
    await chrome.storage.local.set({ [NOTIFIED_KEY(taskId)]: true });
  } else {
    await chrome.storage.local.remove(NOTIFIED_KEY(taskId));
  }
}

async function clearNotifiedFlag(taskId: string): Promise<void> {
  await chrome.storage.local.remove(NOTIFIED_KEY(taskId));
}

async function fromBackend(t: BackendTask): Promise<LeadTask> {
  return {
    id: t.id,
    leadId: t.leadId,
    leadName: t.lead?.name ?? '',
    type: t.type.toLowerCase() as LeadTaskType,
    title: t.title,
    description: t.description ?? '',
    dueAt: t.dueDate ?? '',
    status: t.isDone ? 'done' : 'pending',
    createdAt: t.createdAt,
    completedAt: t.doneAt,
    notified: await getNotifiedFlag(t.id),
  };
}

export const tasksService = {
  async listTasks(leadId: string): Promise<LeadTask[]> {
    const tasks = await http.get<BackendTask[]>(
      `/tasks?leadId=${encodeURIComponent(leadId)}`
    );
    if (!Array.isArray(tasks)) return [];
    return Promise.all(tasks.map(fromBackend));
  },

  async addTask(
    leadId: string,
    task: LeadTask,
    extra?: { whatsappTemplateId?: string; whatsappMessageBody?: string }
  ): Promise<LeadTask> {
    // O id do `task` vem gerado pelo handler via crypto.randomUUID, mas
    // o backend gera próprio UUID e devolve no response. O id do client
    // é descartado.
    const body: Record<string, unknown> = {
      leadId,
      type: task.type.toUpperCase(),
      title: task.title,
      description: task.description || undefined,
      dueDate: task.dueAt || undefined,
    };
    // Campos opcionais — backend Fase 1 grava sendStatus='PENDING' quando
    // type='WHATSAPP' + dueDate + (whatsappTemplateId OU whatsappMessageBody),
    // ativando o scheduler. Sem isso, vira tarefa-lembrete normal.
    if (extra?.whatsappTemplateId) body.whatsappTemplateId = extra.whatsappTemplateId;
    if (extra?.whatsappMessageBody) body.whatsappMessageBody = extra.whatsappMessageBody;

    const created = await http.post<BackendTask>('/tasks', body);
    const result = await fromBackend(created);
    // Se o handler marcou notified=true (caso dueAt já passado),
    // persistimos a flag local.
    if (task.notified) {
      await setNotifiedFlag(result.id, true);
      result.notified = true;
    }
    return result;
  },

  async updateTask(
    leadId: string,
    taskId: string,
    patch: Partial<LeadTask>
  ): Promise<LeadTask> {
    // Separa flag local (notified) dos campos do backend.
    if (patch.notified !== undefined) {
      await setNotifiedFlag(taskId, patch.notified);
    }

    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.description !== undefined) {
      body.description = patch.description || null;
    }
    if (patch.dueAt !== undefined) {
      body.dueDate = patch.dueAt || null;
    }
    if (patch.type !== undefined) {
      body.type = patch.type.toUpperCase();
    }
    if (patch.status !== undefined) {
      body.isDone = patch.status === 'done';
    }

    // Se não há nada pra mandar pro backend (só notified), retorna a
    // task atual via listTasks(leadId) + filter — preserva contrato.
    if (Object.keys(body).length === 0) {
      const list = await this.listTasks(leadId);
      const current = list.find((t) => t.id === taskId);
      if (!current) throw new Error('Tarefa não encontrada');
      return current;
    }

    const updated = await http.patch<BackendTask>(
      `/tasks/${encodeURIComponent(taskId)}`,
      body
    );
    return fromBackend(updated);
  },

  async deleteTask(_leadId: string, taskId: string): Promise<void> {
    await http.delete(`/tasks/${encodeURIComponent(taskId)}`);
    await clearNotifiedFlag(taskId);
  },

  async markStatus(
    _leadId: string,
    taskId: string,
    status: LeadTaskStatus
  ): Promise<LeadTask> {
    const updated = await http.patch<BackendTask>(
      `/tasks/${encodeURIComponent(taskId)}`,
      { isDone: status === 'done' }
    );
    return fromBackend(updated);
  },

  /**
   * Usado pelo SW quando alarm dispara. SW só tem taskId (do nome do
   * alarm) — sem leadId. Solução: GET /tasks (sem filtro) traz todas
   * as tasks do tenant que o SELLER vê (scope no backend); filtramos
   * por id no client.
   */
  async findTaskGlobally(taskId: string): Promise<LeadTask | null> {
    const tasks = await http.get<BackendTask[]>('/tasks');
    if (!Array.isArray(tasks)) return null;
    const found = tasks.find((t) => t.id === taskId);
    return found ? fromBackend(found) : null;
  },

  /**
   * CAS pra notificar exatamente 1 vez por task. Lê task do backend +
   * flag local; se task ainda pending E flag local não setada, marca
   * a flag e retorna a task; senão retorna null (não notifica).
   */
  async markNotifiedIfPending(taskId: string): Promise<LeadTask | null> {
    const task = await this.findTaskGlobally(taskId);
    if (!task) return null;
    if (task.status !== 'pending') return null;
    const already = await getNotifiedFlag(taskId);
    if (already) return null;
    await setNotifiedFlag(taskId, true);
    return { ...task, notified: true };
  },
};
