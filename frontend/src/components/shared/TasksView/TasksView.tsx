import { useState, useEffect, useCallback } from 'react'
import {
  Mail, MessageCircle, Phone, Video, FileText, Handshake, ShieldCheck,
  Check, Plus, ChevronRight, Users, BarChart2, BookOpen, Loader2,
  type LucideIcon,
} from 'lucide-react'
import AppLayout from '../AppLayout/AppLayout'
import type { SidebarEntry } from '../Sidebar/Sidebar'
import TaskDrawer from '../TaskDrawer/TaskDrawer'
import {
  getTasks, completeTask as completeTaskApi,
  getManagerialTasks, completeManagerialTask as completeManagerialApi,
} from '../../../services/tasks.service'

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
  proposal: { icon: FileText, color: '#9ca3af', label: 'Proposta' },
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
    stageColor: '#6b7280',
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
            <span style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', flexShrink: 0 }}>Tarefas</span>
            <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
              {periodFilters.map((pf) => {
                const active = periodFilter === pf.key
                return (
                  <button key={pf.key} onClick={() => setPeriodFilter(pf.key)} style={{
                    borderRadius: 999, padding: '5px 11px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: active ? 'rgba(249,115,22,0.12)' : '#161a22',
                    border: `1px solid ${active ? '#f97316' : '#22283a'}`,
                    color: active ? '#f97316' : '#6b7280',
                    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                  }}>
                    {pf.label}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
                      background: pf.badgeColor ? `${pf.badgeColor}1F` : '#22283a',
                      color: pf.badgeColor ?? '#9ca3af',
                    }}>{pf.count}</span>
                  </button>
                )
              })}
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
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
                  border: `1px solid ${active ? tf.color : '#22283a'}`,
                  background: active ? `${tf.color}14` : 'transparent',
                  color: active ? tf.color : '#6b7280',
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
                    background: active ? 'rgba(249,115,22,0.12)' : '#161a22',
                    border: `1px solid ${active ? '#f97316' : '#22283a'}`,
                    color: active ? '#f97316' : '#6b7280',
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
              <span style={{ fontSize: 14, color: '#6b7280' }}>Carregando tarefas...</span>
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
                    <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>Nenhuma tarefa encontrada.</div>
                  )}
                </>
              )}

              {/* Managerial tasks */}
              {category === 'gerenciais' && (
                <div>
                  {mTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>Nenhuma tarefa gerencial encontrada.</div>
                  ) : mTasks.map((mt) => {
                    const Icon = mt.icon
                    return (
                      <div
                        key={mt.id}
                        style={{
                          background: '#161a22', border: '1px solid #22283a', borderRadius: 10,
                          padding: 14, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#1c2130'; e.currentTarget.style.borderColor = '#374151' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#161a22'; e.currentTarget.style.borderColor = '#22283a' }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: `${mt.iconColor}1F`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={16} color={mt.iconColor} strokeWidth={1.5} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{mt.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 500, background: '#22283a', color: '#9ca3af', borderRadius: 4, padding: '2px 8px' }}>
                              {mt.recurrence}
                            </span>
                            <span style={{ fontSize: 11, color: mt.overdue ? '#ef4444' : '#9ca3af', fontWeight: mt.overdue ? 600 : 400 }}>
                              {mt.deadline}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexShrink: 0 }}>
                          {mt.participants.map((p, i) => (
                            <div key={p} style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: '#22283a', border: '2px solid #161a22',
                              fontSize: 9, fontWeight: 700, color: '#e8eaf0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              marginLeft: i > 0 ? -8 : 0, zIndex: mt.participants.length - i,
                            }}>{p}</div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleManagerialComplete(mt.id)}
                          style={{
                            background: 'transparent', border: '1px solid #22283a',
                            borderRadius: 6, padding: '5px 10px', fontSize: 12,
                            color: '#9ca3af', cursor: 'pointer',
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
            <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Resumo da semana</div>

              <SummaryCard label="Atrasadas" value={String(taskCounts.overdue)} color="#ef4444" />
              <SummaryCard label="Para hoje" value={String(taskCounts.today)} color="#f97316" />
              <SummaryCard label="Esta semana" value={String(taskCounts.week)} color="#e8eaf0" />
              <SummaryCard label="Concluídas" value={String(taskCounts.done)} color="#22c55e" />

              <div style={{ borderTop: '1px solid #22283a', margin: '16px 0' }} />

              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Nova tarefa rápida</div>
              <input placeholder="Título da tarefa..." style={{
                width: '100%', background: '#0f1117', border: '1px solid #22283a', borderRadius: 8,
                padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box',
              }} />
              <button style={{
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
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: '#161a22', border: '1px solid #22283a', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#e8eaf0', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}
      {selectedTask && <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} onComplete={handleDrawerComplete} />}
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
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #22283a', paddingBottom: 8, marginBottom: 12 }}>
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
        background: selected ? 'rgba(249,115,22,0.06)' : hovered ? '#1c2130' : '#161a22',
        border: `1px solid ${hovered || selected ? '#374151' : '#22283a'}`,
        borderLeft: selected ? '2px solid #f97316' : `1px solid ${hovered ? '#374151' : '#22283a'}`,
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
          border: task.done ? 'none' : '1px solid #22283a',
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
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0', textDecoration: task.done ? 'line-through' : 'none' }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#22283a', fontSize: 8, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {task.leadInitials}
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{task.leadName}{task.leadCompany ? ` · ${task.leadCompany}` : ''}</span>
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
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{task.time}</span>
          ) : null}
        </div>
      </div>

      {/* Details button */}
      <button onClick={onSelect}
        onMouseEnter={() => setBtnHov(true)} onMouseLeave={() => setBtnHov(false)}
        style={{
          background: btnHov ? 'rgba(249,115,22,0.06)' : 'transparent',
          border: `1px solid ${btnHov ? '#f97316' : '#22283a'}`,
          borderRadius: 6, padding: '5px 10px', fontSize: 12,
          color: btnHov ? '#f97316' : '#9ca3af', cursor: 'pointer',
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
    <div style={{ background: '#0f1117', borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}
