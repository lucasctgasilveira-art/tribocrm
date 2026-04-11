import { useState } from 'react'
import {
  X, Clock, Mail, MessageCircle, Phone, Video, FileText,
  Handshake, ShieldCheck, Loader2, ExternalLink, Pencil, Trash2,
  type LucideIcon,
} from 'lucide-react'
import api from '../../../services/api'

// ── Types ──

type TaskType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'visit' | 'proposal' | 'approve'

function taskTypeToInteractionType(t: TaskType): string {
  switch (t) {
    case 'call': return 'CALL'
    case 'email': return 'EMAIL'
    case 'whatsapp': return 'WHATSAPP'
    case 'meeting': return 'MEETING'
    case 'visit': return 'VISIT'
    default: return 'NOTE'
  }
}

export interface TaskDrawerData {
  id: string; type: TaskType; apiType?: string; title: string; description?: string
  leadId?: string
  leadInitials: string; leadName: string; leadCompany: string
  stageBadge: string; stageColor: string
  time: string; dueDate?: string | null; overdue: boolean; done: boolean
  calendarBadge?: boolean; doneDate?: string; detail?: string
  // Real responsible / creator names for the Detalhes block. Optional
  // so adapters (e.g. the managerial branch in TasksView) that don't
  // have this info can simply omit them — the drawer falls back to
  // `você` when responsibleName is missing.
  responsibleName?: string
  createdByName?: string | null
}

interface Props {
  task: TaskDrawerData
  onClose: () => void
  onComplete: (id: string, notes?: string) => void
  onReschedule?: (id: string, newDueDate: string) => Promise<void> | void
  onEdit?: (id: string, payload: { title: string; type: string; description?: string; dueDate?: string }) => Promise<void> | void
  onDelete?: (id: string) => Promise<void> | void
  onViewLead?: (leadId: string) => void
}

const typeConfig: Record<TaskType, { icon: LucideIcon; color: string; label: string }> = {
  call: { icon: Phone, color: '#f97316', label: 'Ligação' },
  email: { icon: Mail, color: '#3b82f6', label: 'E-mail' },
  whatsapp: { icon: MessageCircle, color: '#25d166', label: 'WhatsApp' },
  meeting: { icon: Video, color: '#a855f7', label: 'Reunião' },
  visit: { icon: Handshake, color: '#f59e0b', label: 'Visita' },
  proposal: { icon: FileText, color: 'var(--text-secondary)', label: 'Proposta' },
  approve: { icon: ShieldCheck, color: '#22c55e', label: 'Liberar Pedido' },
}

const CSS = `
  @keyframes tdSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
  @keyframes tdFadeIn{from{opacity:0}to{opacity:1}}
  .td-body::-webkit-scrollbar{width:4px}.td-body::-webkit-scrollbar-track{background:transparent}
  .td-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  .td-body{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
`

export default function TaskDrawer({ task, onClose, onComplete, onReschedule, onEdit, onDelete, onViewLead }: Props) {
  const tc = typeConfig[task.type]
  const Icon = tc.icon
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <style>{CSS}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, animation: 'tdFadeIn 0.2s ease-out' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, width: 400, height: '100vh', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'tdSlideIn 0.25s ease-out' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Tarefas → {tc.label}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${tc.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={tc.color} strokeWidth={1.5} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{task.title}</h2>
                <div style={{ marginTop: 6 }}>
                  {task.done ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 600 }}>Concluída · {task.doneDate}</span>
                  ) : task.overdue ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 600 }}>Atrasada · {task.time}</span>
                  ) : task.time.includes('Aguardando') ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(249,115,22,0.12)', color: '#f97316', fontWeight: 600 }}>{task.time}</span>
                  ) : task.time ? (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Prazo: {task.time}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {onEdit && task.type !== 'approve' && (
                <button onClick={() => setEditOpen(true)} title="Editar"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6 }}>
                  <Pencil size={16} strokeWidth={1.5} />
                </button>
              )}
              {onDelete && (
                <button onClick={() => setConfirmDelete(true)} title="Excluir"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 6, borderRadius: 6 }}>
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              )}
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="td-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {task.type === 'approve' ? (
            <ApproveContent task={task} onClose={onClose} onComplete={onComplete} />
          ) : (
            <CommonContent task={task} onClose={onClose} onComplete={onComplete} onReschedule={() => setRescheduleOpen(true)} onViewLead={onViewLead} />
          )}
        </div>
      </div>
      {rescheduleOpen && onReschedule && (
        <RescheduleModal task={task} onClose={() => setRescheduleOpen(false)} onSave={async (dt) => {
          await onReschedule(task.id, dt)
          setRescheduleOpen(false)
          // Keep the drawer open — parent updates the task's dueDate so the
          // prazo re-renders with the new date/time.
        }} />
      )}
      {editOpen && onEdit && (
        <EditTaskModal task={task} onClose={() => setEditOpen(false)} onSave={async (p) => {
          await onEdit(task.id, p)
          setEditOpen(false)
          onClose()
        }} />
      )}
      {confirmDelete && onDelete && (
        <ConfirmDeleteModal taskTitle={task.title} onClose={() => setConfirmDelete(false)} onConfirm={async () => {
          await onDelete(task.id)
          setConfirmDelete(false)
          onClose()
        }} />
      )}
    </>
  )
}

// ── Common task content ──

function CommonContent({ task, onClose, onComplete, onReschedule, onViewLead }: { task: TaskDrawerData; onClose: () => void; onComplete: (id: string, notes?: string) => void; onReschedule?: () => void; onViewLead?: (leadId: string) => void }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // IMPORTANT: the interaction POST runs here (not in the parent) so it
  // can use the fresh `task.leadId` prop and the fresh local `notes`
  // state. A previous attempt delegated this to TasksView.handleDrawerComplete
  // via a callback, which ran after setTimeout/setSelectedTask(null) — by
  // the time the async handler read the parent's `tasks` array, the task
  // had already been mutated and the POST was silently skipped.
  async function handleComplete() {
    const trimmed = notes.trim()
    console.log('[TaskDrawer.handleComplete] taskId=%s leadId=%s type=%s notesLen=%d', task.id, task.leadId, task.type, trimmed.length)
    setSaving(true)

    if (trimmed && task.leadId) {
      const body = {
        type: taskTypeToInteractionType(task.type),
        content: trimmed,
        description: trimmed,
      }
      console.log('[TaskDrawer] POST /leads/%s/interactions body=%o', task.leadId, body)
      try {
        const res = await api.post(`/leads/${task.leadId}/interactions`, body)
        console.log('[TaskDrawer] interaction saved:', res.data)
      } catch (err: any) {
        // Do not block completion — log and continue.
        console.error('[TaskDrawer] failed to register result:', err?.response?.data ?? err)
      }
    }

    try {
      await Promise.resolve(onComplete(task.id, trimmed || undefined))
    } finally {
      onClose()
    }
  }

  return (
    <>
      {/* Lead — hidden for managerial tasks (no linked lead) */}
      {task.leadId && (
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Lead vinculado</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{task.leadInitials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{task.leadName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.leadCompany}</div>
          </div>
          {task.stageBadge && (
            <span style={{ background: `${task.stageColor}1F`, color: task.stageColor, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{task.stageBadge}</span>
          )}
          {onViewLead && task.leadId && (
            <button onClick={() => onViewLead(task.leadId!)} title="Ver lead"
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <ExternalLink size={12} strokeWidth={1.5} /> Ver
            </button>
          )}
        </div>
      </div>
      )}

      {/* Details */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Detalhes</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--text-primary)' }}>
          <Clock size={14} color="var(--text-muted)" strokeWidth={1.5} />
          <span>{task.time || '—'}</span>
          {task.calendarBadge && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Google Calendar</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
          {task.leadInitials && (
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{task.leadInitials.slice(0, 2)}</div>
          )}
          <span style={{ color: 'var(--text-secondary)' }}>Responsável: {task.responsibleName ?? 'você'}</span>
        </div>
        {task.createdByName && task.createdByName !== task.responsibleName && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginLeft: task.leadInitials ? 28 : 0 }}>
            Agendada por: {task.createdByName}
          </div>
        )}
      </div>

      {/* Description — rendered only when the task has one saved */}
      {task.description && task.description.trim() && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Descrição</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{task.description}</div>
        </div>
      )}

      {/* Registrar resultado — only for lead-linked tasks. A managerial
          task has no lead, so there's nowhere to attach the interaction. */}
      {task.leadId && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Registrar resultado</div>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="O que aconteceu nessa interação? (opcional)"
            style={{
              width: '100%', background: 'var(--bg)', borderRadius: 8, padding: 10, fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box',
              border: '1px solid var(--border)',
            }} />
        </div>
      )}

      {/* Footer */}
      {!task.done && (
        <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onReschedule} disabled={!onReschedule} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, color: 'var(--text-secondary)', cursor: onReschedule ? 'pointer' : 'not-allowed' }}>Remarcar</button>
          <button onClick={handleComplete} disabled={saving} style={{
            flex: 1, background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 0',
            fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Concluindo...</> : 'Concluir tarefa ✓'}
          </button>
        </div>
      )}
    </>
  )
}

// ── Reschedule / Edit / Delete Modals ──

const tdOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 70 }
const tdBox: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '92vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 71 }
const tdInput: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const tdLabel: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }

function extractLocalDateTime(iso: string | null | undefined): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` }
}

function RescheduleModal({ task, onClose, onSave }: { task: TaskDrawerData; onClose: () => void; onSave: (dueDate: string) => Promise<void> }) {
  const initial = extractLocalDateTime(task.dueDate)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!date || !time) { setError('Informe data e horário'); return }
    // Build a local-time Date then serialize to UTC ISO. `new Date("YYYY-MM-DDTHH:mm:ss")`
    // with no Z suffix is interpreted in the browser's local timezone.
    const localIso = `${date}T${time}:00`
    const parsed = new Date(localIso)
    if (Number.isNaN(parsed.getTime())) { setError('Data/horário inválidos'); return }
    setSaving(true)
    setError('')
    try { await onSave(parsed.toISOString()) } catch { setSaving(false); setError('Erro ao salvar') }
  }

  return (
    <>
      <div onClick={onClose} style={tdOverlay} />
      <div style={tdBox}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Remarcar tarefa</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={tdLabel}>Nova data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={tdInput} />
          </div>
          <div style={{ width: 130 }}>
            <label style={tdLabel}>Horário</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={tdInput} />
          </div>
        </div>
        {error && (
          <div style={{ padding: '0 24px 12px', fontSize: 12, color: '#ef4444' }}>{error}</div>
        )}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ background: saving ? 'var(--border)' : '#f97316', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </>
  )
}

function EditTaskModal({ task, onClose, onSave }: { task: TaskDrawerData; onClose: () => void; onSave: (p: { title: string; type: string; description?: string; dueDate?: string }) => Promise<void> }) {
  const [title, setTitle] = useState(task.title)
  const [type, setType] = useState(task.apiType ?? 'CALL')
  const [description, setDescription] = useState(task.description ?? '')
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)
  const canSave = title.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({ title: title.trim(), type, description: description || undefined, dueDate: dueDate || undefined })
    } catch { setSaving(false) }
  }

  return (
    <>
      <div onClick={onClose} style={tdOverlay} />
      <div style={tdBox}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Editar tarefa</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={tdLabel}>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={tdInput} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={tdLabel}>Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...tdInput, cursor: 'pointer' }}>
              <option value="CALL">Ligação</option>
              <option value="EMAIL">E-mail</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="MEETING">Reunião</option>
              <option value="VISIT">Visita</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={tdLabel}>Data</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={tdInput} />
          </div>
          <div>
            <label style={tdLabel}>Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...tdInput, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </>
  )
}

function ConfirmDeleteModal({ taskTitle, onClose, onConfirm }: { taskTitle: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  async function handleConfirm() {
    setSaving(true)
    try { await onConfirm() } catch { setSaving(false) }
  }
  return (
    <>
      <div onClick={onClose} style={tdOverlay} />
      <div style={tdBox}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Excluir tarefa</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Tem certeza que deseja excluir a tarefa <strong style={{ color: 'var(--text-primary)' }}>"{taskTitle}"</strong>? Esta ação não pode ser desfeita.
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={saving} style={{ background: saving ? 'var(--border)' : '#ef4444', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Excluindo...' : 'Excluir'}</button>
        </div>
      </div>
    </>
  )
}

// ── Approve task content ──

function ApproveContent({ task, onClose, onComplete }: { task: TaskDrawerData; onClose: () => void; onComplete: (id: string) => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingReject, setSavingReject] = useState(false)
  const [observation, setObservation] = useState('')
  const [pwError, setPwError] = useState(false)

  function handleApprove() {
    if (!password) { setPwError(true); return }
    setSaving(true)
    setTimeout(() => { onComplete(task.id); onClose() }, 800)
  }

  function handleReject() {
    if (!password) { setPwError(true); return }
    setSavingReject(true)
    setTimeout(() => { onComplete(task.id); onClose() }, 800)
  }

  return (
    <>
      {/* S1 — Resumo do pedido */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Resumo do pedido</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow label="SOLICITANTE" avatar="AN" value="Ana Souza · Vendedora" />
          <InfoRow label="CLIENTE" avatar="CT" value="Camila Torres · Torres & Filhos" />
          <InfoRow label="PRODUTO" value="Plano Pro — Anual" />
          <InfoRow label="SOLICITADO" value="há 2 horas" />
        </div>
      </div>

      {/* S2 — Valores */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Valores</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <ValueCard label="Valor original" value="R$ 12.000" color="var(--text-primary)" />
          <ValueCard label="Desconto" value="20%" color="#ef4444" />
          <ValueCard label="Valor final" value="R$ 9.600" color="#22c55e" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Economia para o cliente: <span style={{ color: '#f59e0b', fontWeight: 600 }}>R$ 2.400</span></div>
        <span style={{ display: 'inline-block', marginTop: 8, background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Acima do limite — máximo 15%</span>
      </div>

      {/* S3 — Justificativa */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Justificativa do vendedor</div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          "Cliente tem potencial de fechar anual se dermos 20%. Já negociamos por 3 semanas. Se não aprovar, perdemos para o concorrente."
        </div>
      </div>

      {/* S4 — Histórico do cliente */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Histórico do cliente</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Cliente desde: </span><span style={{ color: 'var(--text-primary)' }}>Jan/2025</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Total comprado: </span><span style={{ color: '#22c55e', fontWeight: 700 }}>R$ 35.000</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Última compra: </span><span style={{ color: 'var(--text-primary)' }}>Mar/2026 — Treinamento Equipe</span></div>
        </div>
      </div>

      {/* S5 — Observation + password */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Observação (opcional)</label>
          <textarea rows={2} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Observação sobre a aprovação..."
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Senha do aprovador <span style={{ color: '#f97316' }}>*</span></label>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPwError(false) }} placeholder="Digite sua senha"
            style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${pwError ? '#ef4444' : 'var(--border)'}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          {pwError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Digite a senha para confirmar</div>}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexShrink: 0, borderTop: '1px solid var(--border)' }}>
        <button onClick={handleReject} disabled={savingReject} style={{
          flex: 1, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {savingReject ? <><Loader2 size={14} className="animate-spin" /> Recusando...</> : 'Recusar'}
        </button>
        <button onClick={handleApprove} disabled={saving} style={{
          flex: 1, background: '#22c55e', border: 'none', borderRadius: 8, padding: '9px 0',
          fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Aprovando...</> : 'Aprovar ✓'}
        </button>
      </div>
    </>
  )
}

// ── Approve sub-components ──

function InfoRow({ label, avatar, value }: { label: string; avatar?: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', width: 80, flexShrink: 0 }}>{label}</span>
      {avatar && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--border)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatar}</div>}
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function ValueCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}
