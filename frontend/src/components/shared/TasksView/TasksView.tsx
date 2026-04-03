import { useState } from 'react'
import {
  Mail, MessageCircle, Phone, Video, FileText, Handshake,
  Check, Plus, type LucideIcon,
} from 'lucide-react'
import AppLayout from '../AppLayout/AppLayout'
import type { SidebarEntry } from '../Sidebar/Sidebar'

// ── Types ──

type TaskType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'visit' | 'proposal'
type PeriodFilter = 'overdue' | 'today' | 'week' | 'nextweek' | 'all' | 'done'

interface MockTask {
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
  group: 'today' | 'tomorrow' | 'done'
}

// ── Config ──

const typeConfig: Record<TaskType, { icon: LucideIcon; color: string; label: string }> = {
  call: { icon: Phone, color: '#f97316', label: 'Ligação' },
  email: { icon: Mail, color: '#3b82f6', label: 'E-mail' },
  whatsapp: { icon: MessageCircle, color: '#25d166', label: 'WhatsApp' },
  meeting: { icon: Video, color: '#a855f7', label: 'Reunião' },
  visit: { icon: Handshake, color: '#f59e0b', label: 'Visita' },
  proposal: { icon: FileText, color: '#9ca3af', label: 'Proposta' },
}

const periodFilters: { key: PeriodFilter; label: string; count: number; badgeColor?: string }[] = [
  { key: 'overdue', label: 'Atrasadas', count: 2, badgeColor: '#ef4444' },
  { key: 'today', label: 'Hoje', count: 3, badgeColor: '#f97316' },
  { key: 'week', label: 'Esta semana', count: 7 },
  { key: 'nextweek', label: 'Próxima semana', count: 4 },
  { key: 'all', label: 'Todas', count: 14 },
  { key: 'done', label: 'Concluídas', count: 18 },
]

const typeFilters: { key: TaskType; icon: LucideIcon; color: string; label: string }[] = [
  { key: 'email', icon: Mail, color: '#3b82f6', label: 'E-mail' },
  { key: 'whatsapp', icon: MessageCircle, color: '#25d166', label: 'WhatsApp' },
  { key: 'call', icon: Phone, color: '#f97316', label: 'Ligação' },
  { key: 'meeting', icon: Video, color: '#a855f7', label: 'Reunião' },
  { key: 'visit', icon: Handshake, color: '#f59e0b', label: 'Visita' },
]

// ── Mock Data ──

const mockTasks: MockTask[] = [
  { id: '1', type: 'call', title: 'Follow-up sobre desconto solicitado', leadInitials: 'CT', leadName: 'Camila Torres', leadCompany: 'Torres & Filhos', stageBadge: 'Negociando', stageColor: '#f59e0b', time: '14:00', overdue: true, done: false, group: 'today' },
  { id: '2', type: 'meeting', title: 'Demo ao vivo para a equipe comercial', leadInitials: 'RM', leadName: 'Rafael Mendes', leadCompany: 'MendesNet', stageBadge: 'Em Contato', stageColor: '#3b82f6', time: '16:30', overdue: false, done: false, calendarBadge: true, group: 'today' },
  { id: '3', type: 'email', title: 'Enviar material de apresentação do produto', leadInitials: 'FL', leadName: 'Fernanda Lima', leadCompany: 'Lima Distribuidora', stageBadge: 'Sem Contato', stageColor: '#6b7280', time: '18:00', overdue: false, done: false, group: 'today' },
  { id: '4', type: 'whatsapp', title: 'Enviar link da proposta atualizada', leadInitials: 'PG', leadName: 'Priscila Gomes', leadCompany: 'GomesTech', stageBadge: 'Proposta Enviada', stageColor: '#a855f7', time: '10:00', overdue: false, done: false, group: 'tomorrow' },
  { id: '5', type: 'proposal', title: 'Montar proposta com desconto 5%', leadInitials: 'CT', leadName: 'Camila Torres', leadCompany: 'Torres & Filhos', stageBadge: 'Negociando', stageColor: '#f59e0b', time: '14:00', overdue: false, done: false, group: 'tomorrow' },
  { id: '6', type: 'email', title: 'Enviar contrato revisado', leadInitials: 'DM', leadName: 'Diego Marques', leadCompany: 'Marquesali', stageBadge: 'Proposta Enviada', stageColor: '#a855f7', time: '', overdue: false, done: true, doneDate: '19/03', group: 'done' },
  { id: '7', type: 'call', title: 'Qualificar necessidade e orçamento disponível', leadInitials: 'TB', leadName: 'Thiago Bastos', leadCompany: 'Bastos & Co', stageBadge: 'Em Contato', stageColor: '#3b82f6', time: '', overdue: false, done: true, doneDate: '18/03', group: 'done' },
]

// ── Component ──

interface TasksViewProps {
  menuItems: SidebarEntry[]
}

export default function TasksView({ menuItems }: TasksViewProps) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today')
  const [typeFilter, setTypeFilter] = useState<TaskType | null>(null)
  const [tasks, setTasks] = useState(mockTasks)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function toggleDone(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t))
  }

  const filtered = tasks.filter((t) => {
    if (typeFilter && t.type !== typeFilter) return false
    if (periodFilter === 'overdue') return t.overdue && !t.done
    if (periodFilter === 'today') return t.group === 'today' && !t.done
    if (periodFilter === 'done') return t.done
    if (periodFilter === 'week') return !t.done
    return true
  })

  const todayTasks = filtered.filter((t) => t.group === 'today' && !t.done)
  const tomorrowTasks = filtered.filter((t) => t.group === 'tomorrow' && !t.done)
  const doneTasks = filtered.filter((t) => t.done)

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
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
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

          {/* Task groups */}
          {todayTasks.length > 0 && (
            <TaskGroup label="Hoje — Quinta, 03 de Abril" tasks={todayTasks} hoveredId={hoveredId} setHoveredId={setHoveredId} toggleDone={toggleDone} />
          )}
          {tomorrowTasks.length > 0 && (
            <TaskGroup label="Amanhã — Sexta, 04 de Abril" tasks={tomorrowTasks} hoveredId={hoveredId} setHoveredId={setHoveredId} toggleDone={toggleDone} />
          )}
          {doneTasks.length > 0 && (
            <TaskGroup label="Concluídas recentemente" tasks={doneTasks} hoveredId={hoveredId} setHoveredId={setHoveredId} toggleDone={toggleDone} />
          )}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>Nenhuma tarefa encontrada.</div>
          )}
        </div>

        {/* Right column — Summary */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Resumo da semana</div>

              <SummaryCard label="Atrasadas" value="2" color="#ef4444" />
              <SummaryCard label="Para hoje" value="3" color="#f97316" />
              <SummaryCard label="Esta semana" value="7" color="#e8eaf0" />
              <SummaryCard label="Concluídas" value="18" color="#22c55e" />

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
    </AppLayout>
  )
}

// ── Task Group ──

function TaskGroup({ label, tasks, hoveredId, setHoveredId, toggleDone }: {
  label: string
  tasks: MockTask[]
  hoveredId: string | null
  setHoveredId: (id: string | null) => void
  toggleDone: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #22283a', paddingBottom: 8, marginBottom: 12 }}>
        {label}
      </div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} hovered={hoveredId === task.id} onHover={setHoveredId} toggleDone={toggleDone} />
      ))}
    </div>
  )
}

// ── Task Card ──

function TaskCard({ task, hovered, onHover, toggleDone }: {
  task: MockTask
  hovered: boolean
  onHover: (id: string | null) => void
  toggleDone: (id: string) => void
}) {
  const tc = typeConfig[task.type]
  const Icon = tc.icon

  return (
    <div
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: hovered ? '#1c2130' : '#161a22',
        border: `1px solid ${hovered ? '#374151' : '#22283a'}`,
        borderRadius: 10, padding: 14, marginBottom: 8,
        display: 'flex', gap: 12, alignItems: 'flex-start',
        transition: 'all 0.15s', opacity: task.done ? 0.5 : 1,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={() => toggleDone(task.id)}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer', marginTop: 2,
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
        {/* Lead info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#22283a', fontSize: 8, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {task.leadInitials}
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{task.leadName} · {task.leadCompany}</span>
          <span style={{ background: `${task.stageColor}1F`, color: task.stageColor, borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
            {task.stageBadge}
          </span>
        </div>
        {/* Time / badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {task.done && task.doneDate ? (
            <span style={{ fontSize: 12, color: '#22c55e' }}>Feito · {task.doneDate}</span>
          ) : task.overdue ? (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 600 }}>
              Atrasada · {task.time}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{task.time}</span>
          )}
          {task.calendarBadge && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Google Calendar</span>
          )}
        </div>
      </div>
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
