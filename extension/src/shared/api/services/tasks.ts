/**
 * TODO(backend): quando existirem endpoints /leads/:id/tasks,
 * dividir em tasks.service.ts (real) + mockTasksService em
 * ../../mocks/services.ts, seguindo o padrão de leads/messages.
 *
 * Quando isso acontecer, o filtro por usuário/tenant será feito no
 * backend (via Row Level Security). O userId na chave local vira
 * redundante mas ainda útil como cache em navegadores multi-usuário.
 *
 * Persistência atual: chrome.storage.local com chave
 *   lead-tasks:{userId}:{leadId}
 * O userId garante isolamento entre sessões no mesmo navegador.
 *
 * Este service NÃO agenda chrome.alarms nem dispara notificações —
 * só toca storage. O orchestramento de alarms/notifications fica
 * no handler (background/handlers.ts) e no service worker
 * (background/service-worker.ts). Motivo: quando trocarmos storage
 * por HTTP, o agendamento de alarm continua local e essa separação
 * evita mexer no lugar errado.
 */

import type { LeadTask, LeadTaskStatus } from '@shared/types/extra';
import { storage } from '@shared/utils/storage';

const KEY = (userId: string, leadId: string) => `lead-tasks:${userId}:${leadId}`;

async function getUserId(): Promise<string | null> {
  const auth = await storage.get('auth');
  return auth?.user?.id ?? null;
}

async function readList(userId: string, leadId: string): Promise<LeadTask[]> {
  const key = KEY(userId, leadId);
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return Array.isArray(value) ? (value as LeadTask[]) : [];
}

async function writeList(userId: string, leadId: string, list: LeadTask[]): Promise<void> {
  await chrome.storage.local.set({ [KEY(userId, leadId)]: list });
}

export const tasksService = {
  async listTasks(leadId: string): Promise<LeadTask[]> {
    const userId = await getUserId();
    if (!userId) return [];
    return readList(userId, leadId);
  },

  async addTask(leadId: string, task: LeadTask): Promise<LeadTask> {
    const userId = await getUserId();
    if (!userId) throw new Error('Sessão expirada — faça login novamente');
    const list = await readList(userId, leadId);
    await writeList(userId, leadId, [...list, task]);
    return task;
  },

  async updateTask(
    leadId: string,
    taskId: string,
    patch: Partial<LeadTask>
  ): Promise<LeadTask> {
    const userId = await getUserId();
    if (!userId) throw new Error('Sessão expirada — faça login novamente');
    const list = await readList(userId, leadId);
    const idx = list.findIndex((t) => t.id === taskId);
    if (idx < 0) throw new Error('Tarefa não encontrada');
    const updated: LeadTask = { ...list[idx], ...patch, id: list[idx].id };
    const next = [...list];
    next[idx] = updated;
    await writeList(userId, leadId, next);
    return updated;
  },

  async deleteTask(leadId: string, taskId: string): Promise<void> {
    const userId = await getUserId();
    if (!userId) return;
    const list = await readList(userId, leadId);
    const next = list.filter((t) => t.id !== taskId);
    if (next.length !== list.length) {
      await writeList(userId, leadId, next);
    }
  },

  async markStatus(
    leadId: string,
    taskId: string,
    status: LeadTaskStatus
  ): Promise<LeadTask> {
    const completedAt = status === 'done' ? new Date().toISOString() : null;
    return this.updateTask(leadId, taskId, { status, completedAt });
  },

  /**
   * Usado SÓ pelo service worker quando um alarm dispara. O SW tem o
   * taskId (do nome do alarm) mas não o leadId — varre todas as chaves
   * `lead-tasks:*` pra achar. Custo O(N_chaves × M_tasks_por_chave),
   * aceitável no volume do MVP.
   */
  async findTaskGlobally(
    taskId: string
  ): Promise<{ storageKey: string; task: LeadTask; list: LeadTask[] } | null> {
    const all = await chrome.storage.local.get(null);
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('lead-tasks:')) continue;
      if (!Array.isArray(value)) continue;
      const list = value as LeadTask[];
      const task = list.find((t) => t.id === taskId);
      if (task) return { storageKey: key, task, list };
    }
    return null;
  },

  /**
   * Read-modify-write atômico (optimistic): marca notified=true se e somente
   * se a task ainda está pending e notified=false. Usado pelo listener do
   * alarm pra evitar race entre "fire" e "user marcou como done".
   * Retorna a task atualizada ou null se a condição não foi satisfeita.
   */
  async markNotifiedIfPending(taskId: string): Promise<LeadTask | null> {
    const found = await this.findTaskGlobally(taskId);
    if (!found) return null;
    if (found.task.status !== 'pending' || found.task.notified) return null;
    const updatedList = found.list.map((t) =>
      t.id === taskId ? { ...t, notified: true } : t
    );
    await chrome.storage.local.set({ [found.storageKey]: updatedList });
    return { ...found.task, notified: true };
  }
};
