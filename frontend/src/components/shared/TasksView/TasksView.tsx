import { useState, useEffect, useCallback } from 'react'
import {
  Mail, MessageCircle, Phone, Video, FileText, Handshake, ShieldCheck,
  Check, Plus, ChevronRight, Users, BarChart2, BookOpen, Loader2, X,
  type LucideIcon,
} from 'lucide-react'
import AppLayout from '../AppLayout/AppLayout'
import type { SidebarEntry } from '../Sidebar/Sidebar'
import TaskDrawer from '../TaskDrawer/TaskDrawer'
import {
  getTasks, completeTask as completeTaskApi,
  getManagerialTasks, completeManagerialTask as completeManagerialApi,
  createManagerialTask,
} from '../../../services/tasks.service'
import { getUsers } from '../../../services/users.service'
import api from '../../../services/api'

// ── Types ──

type TaskType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'visit' | 'proposal' | 'approve'
type PeriodFilter = 'overdue' | 'today' | 'week' | 'nextweek' | 'all' | 'done'
type TaskCategory = 'leads' | 'gerenciais'

interface ApiTask {
  id: string
  type: string
  title: string
  description: string | null
  dueDate: string | null
  isDone: boolean
  doneAt: string | null
  createdAt: string
  lead: { id: string; name: string; company: string | null }
  responsible: { id: string; name: string }
}

interface ApiManagerialTask {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  isDone: boolean
  doneAt: string | null
  isRecurring: boolean
  recurrence: string | null
  taskType: { id: string; name: string }
  participants: { id: string; userId: string }[]
}

interface DisplayTask {
  id: string
  type: TaskType
  title: string
  leadInitials: string
  leadName: string
  leadCompany: string
  stageBadge: string
  stageColor: string
  time: string
  overdue: boolean
  done: boolean
  calendarBadge?: boolean
  doneDate?: string
  detail?: string
  group: 'today' | 'tomorrow' | 'done'
}

interface DisplayManagerialTask {
  id: string
  icon: LucideIcon
  iconColor: string
  title: string
  recurrence: string
  deadline: string
  overdue: boolean
  participants: string[]
}

// ── Config ──

const typeConfig: Record<TaskType, { icon: LucideIcon; color: string; label: string }> = {
  call: { icon: Phone, color: '#f97316', label: 'Ligação' },
  email: { icon: Mail, color: '#3b82f6', label: 'E-mail' },
  whatsapp: { icon: MessageCircle, color: '#25d166', label: 'WhatsApp' },
  meeting: { icon: Video, color: '#a855f7', label: 'Reunião' },
  visit: { icon: Handshake, color: '#f59e0b', label: 'Visita' },
  proposal: { icon: FileText, color: 'var(--text-secondary)', label: 'Proposta' },
  approve: { icon: ShieldCheck, color: '#22c55e', label: 'Liberar Pedido' },
}

const typeFilters: { key: TaskType; icon: LucideIcon; color: string; label: string }[] = [
  { key: 'email', icon: Mail, color: '#3b82f6', label: 'E-mail' },
  { key: 'whatsapp', icon: MessageCircle, color: '#25d166', label: 'WhatsApp' },
  { key: 'call', icon: Phone, color: '#f97316', label: 'Ligação' },
  { key: 'meeting', icon: Video, color: '#a855f7', label: 'Reunião' },
  { key: 'visit', icon: Handshake, color: '#f59e0b', label: 'Visita' },
  { key: 'approve', icon: ShieldCheck, color: '#22c55e', label: 'Liberar Pedido' },
]

const managerialIconMap: Record<string, { icon: LucideIcon; color: string }> = {
  default: { icon: Users, color: '#f97316' },
  reunião: { icon: Users, color: '#f97316' },
  relatório: { icon: BarChart2, color: '#3b82f6' },
  treinamento: { icon: BookOpen, color: '#a855f7' },
  feedback: { icon: Users, color: '#f97316' },
}

// ── Helpers ──

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor((d.getTime() - startOfDay.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `Atrasada · ${Math.abs(diffDays)}d`
  if (diffDays === 0) return `Vence hoje ${formatTime(dateStr)}`
  if (diffDays === 1) return `Amanhã ${formatTime(dateStr)}`
  if (diffDays <= 7) return 'Esta semana'
  return 'Próxima semana'
}

function isOverdue(dateStr: string | null, isDone: boolean): boolean {
  if (isDone || !dateStr) return false
  return new Date(dateStr) < new Date()
}

function getTaskGroup(dateStr: string | null, isDone: boolean): 'today' | 'tomorrow' | 'done' {
  if (isDone) return 'done'
  if (!dateStr) return 'today'
  const d = new Date(dateStr)
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
  const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000)

  if (d < startOfTomorrow) return 'today'
  if (d < endOfTomorrow) return 'tomorrow'
  return 'today'
}

function mapApiType(apiType: string): TaskType {
  const map: Record<string, TaskType> = {
    CALL: 'call', EMAIL: 'email', WHATSAPP: 'whatsapp',
    MEETING: 'meeting', VISIT: 'visit',
  }
  return map[apiType] ?? 'call'
}

function mapApiTask(t: ApiTask): DisplayTask {
  return {
    id: t.id,
    type: mapApiType(t.type),
    title: t.title,
    leadInitials: getInitials(t.lead.name),
    leadName: t.lead.name,
    leadCompany: t.lead.company ?? '',
    stageBadge: '',
    stageColor: 'var(--text-muted)',
    time: t.isDone ? '' : formatTime(t.dueDate),
    overdue: isOverdue(t.dueDate, t.isDone),
    done: t.isDone,
    doneDate: t.doneAt ? new Date(t.doneAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : undefined,
    group: getTaskGroup(t.dueDate, t.isDone),
  }
}

function mapManagerialTask(t: ApiManagerialTask): DisplayManagerialTask {
  const typeName = t.taskType?.name?.toLowerCase() ?? 'default'
  const iconConfig = managerialIconMap[typeName] ?? managerialIconMap.default!
  return {
    id: t.id,
    icon: iconConfig!.icon,
    iconColor: iconConfig!.color,
    title: t.title,
    recurrence: t.isRecurring && t.recurrence ? t.recurrence : 'Única',
    deadline: formatDeadline(t.dueDate),
    overdue: isOverdue(t.dueDate, t.isDone),
    participants: t.participants.map((_, i) => `P${i + 1}`),
  }
}

function periodToDueDateParam(period: PeriodFilter): string | undefined {
  const map: Record<string, string> = {
    overdue: 'overdue', today: 'today', week: 'week', nextweek: 'next_week',
  }
  return map[period]
}

function periodToStatusParam(period: PeriodFilter): string | undefined {
  if (period === 'done') return 'COMPLETED'
  if (period === 'overdue') return 'PENDING'
  return 'PENDING'
}

// ── Component ──

interface TasksViewProps {
  menuItems: SidebarEntry[]
}

export default function TasksView({ menuItems }: TasksViewProps) {
  const [category, setCategory] = useState<TaskCategory>('leads')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today')
  const [typeFilter, setTypeFilter] = useState<TaskType | null>(null)
  const [loading, setLoading] = useState(true)

  // Lead tasks state
  const [tasks, setTasks] = useState<DisplayTask[]>([])
  const [taskCounts, setTaskCounts] = useState({ overdue: 0, today: 0, week: 0, nextweek: 0, all: 0, done: 0 })

  // Managerial tasks state
  const [mTasks, setMTasks] = useState<DisplayManagerialTask[]>([])

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<DisplayTask | null>(null)
  const [toast, setToast] = useState('')
  const [newTaskModal, setNewTaskModal] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    getUsers().then((data: { id: string; name: string }[]) => setAvailableUsers(data)).catch(() => {})
  }, [])

  // Load counts for period pills
  const loadCounts = useCallback(async () => {
    try {
      const [overdue, today, week, nextweek, all, done] = await Promise.all([
        getTasks({ dueDate: 'overdue', status: 'PENDING', perPage: 1 }),
        getTasks({ dueDate: 'today', status: 'PENDING', perPage: 1 }),
        getTasks({ dueDate: 'week', status: 'PENDING', perPage: 1 }),
        getTasks({ dueDate: 'next_week', status: 'PENDING', perPage: 1 }),
        getTasks({ perPage: 1 }),
        getTasks({ status: 'COMPLETED', perPage: 1 }),
      ])
      setTaskCounts({
        overdue: overdue.meta.total,
        today: today.meta.total,
        week: week.meta.total,
        nextweek: nextweek.meta.total,
        all: all.meta.total,
        done: done.meta.total,
      })
    } catch { /* ignore */ }
  }, [])

  // Load lead tasks
  useEffect(() => {
    if (category !== 'leads') return
    async function load() {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { perPage: 50 }
        const dueDateParam = periodToDueDateParam(periodFilter)
        if (dueDateParam) params.dueDate = dueDateParam
        const statusParam = periodToStatusParam(periodFilter)
        if (statusParam) params.status = statusParam
        if (typeFilter) params.type = typeFilter.toUpperCase()
        if (periodFilter === 'all') { delete params.dueDate; delete params.status }

        const result = await getTasks(params)
        setTasks(result.data.map(mapApiTask))
      } catch {
        setTasks([])
      } finally {
        setLoading(false)
      }
    }
    load()
    loadCounts()
  }, [category, periodFilter, typeFilter, loadCounts])

  // Load managerial tasks
  useEffect(() => {
    if (category !== 'gerenciais') return
    async function load() {
      setLoading(true)
      try {
        const result = await getManagerialTasks({ perPage: 50 })
        setMTasks(result.data.map(mapManagerialTask))
      } catch {
        setMTasks([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [category])

  async function handleToggleDone(id: string) {
    try {
      await completeTaskApi(id)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true, doneDate: 'agora', group: 'done' as const } : t))
      setToast('Tarefa concluída!')
      setTimeout(() => setToast(''), 3000)
      loadCounts()
    } catch { /* ignore */ }
  }

  function handleDrawerComplete(id: string) {
    handleToggleDone(id)
    setSelectedTask(null)
  }

  async function handleCreateManagerialTask(payload: { title: string; typeId: string; description?: string; dueDate?: string; participantIds?: string[]; responsibleId?: string; dueTime?: string; reminderMinutes?: number }) {
    try {
      await createManagerialTask({ title: payload.title, typeId: payload.typeId, description: payload.description, dueDate: payload.dueDate, participantIds: payload.participantIds })
      setNewTaskModal(false)
      setCategory('gerenciais')
      setToast('Tarefa criada!')
      setTimeout(() => setToast(''), 3000)
    } catch {
      setToast('Erro ao criar tarefa')
      setTimeout(() => setToast(''), 3000)
    }
  }

  async function handleManagerialComplete(id: string) {
    try {
      await completeManagerialApi(id)
      setMTasks(prev => prev.filter(t => t.id !== id))
      setToast('Tarefa gerencial concluída!')
      setTimeout(() => setToast(''), 3000)
    } catch { /* ignore */ }
  }

  const todayTasks = tasks.filter(t => t.group === 'today' && !t.done)
  const tomorrowTasks = tasks.filter(t => t.group === 'tomorrow' && !t.done)
  const doneTasks = tasks.filter(t => t.done)

  const periodFilters: { key: PeriodFilter; label: string; count: number; badgeColor?: string }[] = [
    { key: 'overdue', label: 'Atrasadas', count: taskCounts.overdue, badgeColor: '#ef4444' },
    { key: 'today', label: 'Hoje', count: taskCounts.today, badgeColor: '#f97316' },
    { key: 'week', label: 'Esta semana', count: taskCounts.week },
    { key: 'nextweek', label: 'Próxima semana', count: taskCounts.nextweek },
    { key: 'all', label: 'Todas', count: taskCounts.all },
    { key: 'done', label: 'Concluídas', count: taskCounts.done },
  ]

  return (
    <AppLayout menuItems={menuItems}>
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header + period pills + button in one line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>Tarefas</span>
            <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
              {periodFilters.map((pf) => {
                const active = periodFilter === pf.key
                return (
                  <button key={pf.key} onClick={() => setPeriodFilter(pf.key)} style={{
                    borderRadius: 999, padding: '5px 11px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: active ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
                    border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
                    color: active ? '#f97316' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                  }}>
                    {pf.label}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
                      background: pf.badgeColor ? `${pf.badgeColor}1F` : 'var(--border)',
                      color: pf.badgeColor ?? 'var(--text-secondary)',
                    }}>{pf.count}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setNewTaskModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}>
              <Plus size={15} strokeWidth={2} /> Nova Tarefa
            </button>
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {typeFilters.map((tf) => {
              const Icon = tf.icon
              const active = typeFilter === tf.key
              return (
                <button key={tf.key} onClick={() => setTypeFilter(active ? null : tf.key)} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${active ? tf.color : 'var(--border)'}`,
                  background: active ? `${tf.color}14` : 'transparent',
                  color: active ? tf.color : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                }}>
                  <Icon size={14} strokeWidth={1.5} /> {tf.label}
                </button>
              )
            })}
          </div>

          {/* Category toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {([
              { key: 'leads' as const, label: 'Tarefas de leads' },
              { key: 'gerenciais' as const, label: 'Tarefas gerenciais' },
            ]).map((c) => {
              const active = category === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  style={{
                    borderRadius: 999, padding: '6px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: active ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
                    border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
                    color: active ? '#f97316' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>

          {/* Loading */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
              <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando tarefas...</span>
            </div>
          ) : (
            <>
              {/* Lead tasks */}
              {category === 'leads' && (
                <>
                  {todayTasks.length > 0 && (
                    <TaskGroup label="Hoje" tasks={todayTasks} hoveredId={hoveredId} setHoveredId={setHoveredId} toggleDone={handleToggleDone} selectedId={selectedTask?.id ?? null} onSelect={setSelectedTask} />
                  )}
                  {tomorrowTasks.length > 0 && (
                    <TaskGroup label="Amanhã" tasks={tomorrowTasks} hoveredId={hoveredId} setHoveredId={setHoveredId} toggleDone={handleToggleDone} selectedId={selectedTask?.id ?? null} onSelect={setSelectedTask} />
                  )}
                  {doneTasks.length > 0 && (
                    <TaskGroup label="Concluídas recentemente" tasks={doneTasks} hoveredId={hoveredId} setHoveredId={setHoveredId} toggleDone={handleToggleDone} selectedId={selectedTask?.id ?? null} onSelect={setSelectedTask} />
                  )}
                  {tasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma tarefa encontrada.</div>
                  )}
                </>
              )}

              {/* Managerial tasks */}
              {category === 'gerenciais' && (
                <div>
                  {mTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma tarefa gerencial encontrada.</div>
                  ) : mTasks.map((mt) => {
                    const Icon = mt.icon
                    return (
                      <div
                        key={mt.id}
                        style={{
                          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                          padding: 14, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: `${mt.iconColor}1F`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={16} color={mt.iconColor} strokeWidth={1.5} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{mt.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 500, background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 8px' }}>
                              {mt.recurrence}
                            </span>
                            <span style={{ fontSize: 11, color: mt.overdue ? '#ef4444' : 'var(--text-secondary)', fontWeight: mt.overdue ? 600 : 400 }}>
                              {mt.deadline}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexShrink: 0 }}>
                          {mt.participants.map((p, i) => (
                            <div key={p} style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'var(--border)', border: '2px solid var(--bg-card)',
                              fontSize: 9, fontWeight: 700, color: 'var(--text-primary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              marginLeft: i > 0 ? -8 : 0, zIndex: mt.participants.length - i,
                            }}>{p}</div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleManagerialComplete(mt.id)}
                          style={{
                            background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '5px 10px', fontSize: 12,
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                          }}>
                          Concluir <Check size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right column — Summary */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Resumo da semana</div>

              <SummaryCard label="Atrasadas" value={String(taskCounts.overdue)} color="#ef4444" />
              <SummaryCard label="Para hoje" value={String(taskCounts.today)} color="#f97316" />
              <SummaryCard label="Esta semana" value={String(taskCounts.week)} color="var(--text-primary)" />
              <SummaryCard label="Concluídas" value={String(taskCounts.done)} color="#22c55e" />

              <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Nova tarefa rápida</div>
              <input placeholder="Título da tarefa..." style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              }} />
              <button onClick={() => setNewTaskModal(true)} style={{
                width: '100%', marginTop: 8, background: '#f97316', color: '#fff', border: 'none',
                borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <Plus size={14} strokeWidth={2} /> Criar tarefa
              </button>
            </div>
          </div>
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}
      {selectedTask && <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} onComplete={handleDrawerComplete} />}
      {newTaskModal && <NewManagerialTaskModal users={availableUsers} onClose={() => setNewTaskModal(false)} onSave={handleCreateManagerialTask} />}
    </AppLayout>
  )
}

// ── Task Group ──

function TaskGroup({ label, tasks, hoveredId, setHoveredId, toggleDone, selectedId, onSelect }: {
  label: string; tasks: DisplayTask[]; hoveredId: string | null
  setHoveredId: (id: string | null) => void; toggleDone: (id: string) => void
  selectedId: string | null; onSelect: (t: DisplayTask) => void
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
        {label}
      </div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} hovered={hoveredId === task.id} selected={selectedId === task.id} onHover={setHoveredId} toggleDone={toggleDone} onSelect={() => onSelect(task)} />
      ))}
    </div>
  )
}

// ── Task Card ──

function TaskCard({ task, hovered, selected, onHover, toggleDone, onSelect }: {
  task: DisplayTask; hovered: boolean; selected: boolean
  onHover: (id: string | null) => void; toggleDone: (id: string) => void; onSelect: () => void
}) {
  const tc = typeConfig[task.type]
  const Icon = tc.icon
  const [btnHov, setBtnHov] = useState(false)

  return (
    <div
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: selected ? 'rgba(249,115,22,0.06)' : hovered ? 'var(--bg-elevated)' : 'var(--bg-card)',
        border: `1px solid ${hovered || selected ? 'var(--border)' : 'var(--border)'}`,
        borderLeft: selected ? '2px solid #f97316' : `1px solid ${hovered ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 10, padding: 14, marginBottom: 8,
        display: 'flex', gap: 12, alignItems: 'flex-start',
        transition: 'all 0.15s', opacity: task.done ? 0.5 : 1,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={() => { if (!task.done) toggleDone(task.id) }}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: task.done ? 'default' : 'pointer', marginTop: 2,
          border: task.done ? 'none' : '1px solid var(--border)',
          background: task.done ? '#22c55e' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.done && <Check size={12} color="#fff" strokeWidth={2.5} />}
      </div>

      {/* Type icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: `${tc.color}1F`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={tc.color} strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: task.done ? 'line-through' : 'none' }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--border)', fontSize: 8, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {task.leadInitials}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.leadName}{task.leadCompany ? ` · ${task.leadCompany}` : ''}</span>
          {task.stageBadge && (
            <span style={{ background: `${task.stageColor}1F`, color: task.stageColor, borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
              {task.stageBadge}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {task.done && task.doneDate ? (
            <span style={{ fontSize: 12, color: '#22c55e' }}>Feito · {task.doneDate}</span>
          ) : task.overdue ? (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 600 }}>
              Atrasada · {task.time}
            </span>
          ) : task.time ? (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.time}</span>
          ) : null}
        </div>
      </div>

      {/* Details button */}
      <button onClick={onSelect}
        onMouseEnter={() => setBtnHov(true)} onMouseLeave={() => setBtnHov(false)}
        style={{
          background: btnHov ? 'rgba(249,115,22,0.06)' : 'transparent',
          border: `1px solid ${btnHov ? '#f97316' : 'var(--border)'}`,
          borderRadius: 6, padding: '5px 10px', fontSize: 12,
          color: btnHov ? '#f97316' : 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          flexShrink: 0, alignSelf: 'center', transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}>
        Detalhes <ChevronRight size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}

// ── Summary Card ──

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

// ── New Task Modal ──

function NewManagerialTaskModal({ users, onClose, onSave }: {
  users: { id: string; name: string }[]
  onClose: () => void
  onSave: (p: { title: string; typeId: string; description?: string; dueDate?: string; participantIds?: string[]; responsibleId?: string; dueTime?: string; reminderMinutes?: number }) => void
}) {
  const stored = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string; role?: string; teamId?: string }
  const userRole = stored.role ?? 'SELLER'
  const userId = stored.id ?? ''

  const [title, setTitle] = useState('')
  const [typeId, setTypeId] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [recurrence, setRecurrence] = useState('NONE')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [responsibleId, setResponsibleId] = useState(userId)
  const [reminderMinutes, setReminderMinutes] = useState(5)
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [saving, setSaving] = useState(false)

  const taskTypeOpts = [
    { value: 'EMAIL', label: 'E-mail' },
    { value: 'WHATSAPP', label: 'WhatsApp' },
    { value: 'CALL', label: 'Ligação' },
    { value: 'MEETING', label: 'Reunião' },
    { value: 'VISIT', label: 'Visita' },
    { value: 'APPROVE', label: 'Liberar Pedido' },
  ]

  const reminderOpts = [
    { value: 0, label: '0 min (sem lembrete)' },
    { value: 5, label: '5 minutos antes' },
    { value: 15, label: '15 minutos antes' },
    { value: 30, label: '30 minutos antes' },
    { value: 60, label: '1 hora antes' },
    { value: 1440, label: '1 dia antes' },
  ]

  // Load templates when type is EMAIL or WHATSAPP
  useEffect(() => {
    if (typeId === 'EMAIL') {
      api.get('/templates/email').then(r => setTemplates(r.data.data ?? [])).catch(() => setTemplates([]))
    } else if (typeId === 'WHATSAPP') {
      api.get('/templates/whatsapp').then(r => setTemplates(r.data.data ?? [])).catch(() => setTemplates([]))
    } else {
      setTemplates([]); setSelectedTemplate(''); setCustomMessage('')
    }
  }, [typeId])

  // Check calendar connection for MEETING/VISIT
  useEffect(() => {
    if (typeId === 'MEETING' || typeId === 'VISIT') {
      api.get('/oauth/calendar/status').then(r => setCalendarConnected(r.data.data?.connected ?? false)).catch(() => setCalendarConnected(false))
    }
  }, [typeId])

  // Determine visible users based on role
  const showResponsible = userRole !== 'SELLER'
  const visibleUsers = userRole === 'TEAM_LEADER'
    ? users.filter(u => u.id === userId || true) // backend already filters by team
    : users

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const canSave = title.trim().length > 0 && typeId.length > 0 && !saving

  function toggleParticipant(id: string) {
    setParticipantIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function handleSave() {
    if (!canSave) return
    setSaving(true)
    const fullDueDate = dueDate && dueTime ? `${dueDate}T${dueTime}:00` : dueDate || undefined
    onSave({
      title, typeId,
      description: (selectedTemplate === '__custom' ? customMessage : description) || undefined,
      dueDate: fullDueDate,
      participantIds: participantIds.length > 0 ? participantIds : undefined,
      responsibleId: showResponsible ? responsibleId : userId,
      dueTime: dueTime || undefined,
      reminderMinutes,
    })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nova Tarefa</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Título <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Ligar para lead sobre proposta" style={inputS} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tipo <span style={{ color: 'var(--accent)' }}>*</span></label>
              <select value={typeId} onChange={e => setTypeId(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                <option value="">Selecionar tipo...</option>
                {taskTypeOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Notificar com antecedência</label>
              <select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                {reminderOpts.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {/* Conditional: Email/WhatsApp template selector */}
          {(typeId === 'EMAIL' || typeId === 'WHATSAPP') && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                {typeId === 'EMAIL' ? 'Modelo de e-mail' : 'Modelo de WhatsApp'}
              </label>
              <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                <option value="">Nenhum modelo</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value="__custom">Personalizado</option>
              </select>
              {selectedTemplate === '__custom' && (
                <textarea rows={3} value={customMessage} onChange={e => setCustomMessage(e.target.value)}
                  placeholder={typeId === 'EMAIL' ? 'Conteúdo do e-mail...' : 'Mensagem do WhatsApp...'}
                  style={{ ...inputS, resize: 'none', marginTop: 8 } as React.CSSProperties} />
              )}
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 6, background: 'rgba(59,130,246,0.08)', borderRadius: 6, padding: '6px 10px' }}>
                {typeId === 'EMAIL'
                  ? 'O sistema enviará este e-mail automaticamente no horário agendado.'
                  : 'O sistema enviará esta mensagem automaticamente se o WhatsApp Web estiver conectado.'}
              </div>
            </div>
          )}

          {/* Conditional: Meeting/Visit calendar info */}
          {(typeId === 'MEETING' || typeId === 'VISIT') && (
            <div style={{ marginBottom: 16, fontSize: 12, borderRadius: 8, padding: '10px 14px', background: calendarConnected ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${calendarConnected ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, color: calendarConnected ? '#22c55e' : '#f59e0b' }}>
              {calendarConnected
                ? 'Um evento será criado automaticamente no seu Google Calendar.'
                : 'Conecte seu Google Calendar nas configurações para sincronizar.'}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Descrição</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da tarefa..." style={{ ...inputS, resize: 'none' } as React.CSSProperties} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: dueDate ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Quando</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputS} />
            </div>
            {dueDate && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Horário</label>
                <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} style={inputS} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Recorrência</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                <option value="NONE">Nenhuma</option>
                <option value="DAILY">Diária</option>
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="MONTHLY">Mensal</option>
              </select>
            </div>
          </div>

          {/* Responsável — hidden for SELLER */}
          {showResponsible && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Responsável</label>
              <select value={responsibleId} onChange={e => setResponsibleId(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                {visibleUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Participantes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {users.map(u => {
                const selected = participantIds.includes(u.id)
                return (
                  <button key={u.id} onClick={() => toggleParticipant(u.id)} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                    background: selected ? 'rgba(249,115,22,0.12)' : 'transparent',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}>{u.name.split(' ')[0]}{selected ? ' ✓' : ''}</button>
                )
              })}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Criando...' : 'Criar Tarefa'}</button>
        </div>
      </div>
    </>
  )
}
