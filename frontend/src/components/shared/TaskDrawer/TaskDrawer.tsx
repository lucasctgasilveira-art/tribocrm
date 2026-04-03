import { useState } from 'react'
import {
  X, Clock, Mail, MessageCircle, Phone, Video, FileText,
  Handshake, ShieldCheck, Loader2, AlertCircle,
  type LucideIcon,
} from 'lucide-react'

// ── Types ──

type TaskType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'visit' | 'proposal' | 'approve'

export interface TaskDrawerData {
  id: string; type: TaskType; title: string
  leadInitials: string; leadName: string; leadCompany: string
  stageBadge: string; stageColor: string
  time: string; overdue: boolean; done: boolean
  calendarBadge?: boolean; doneDate?: string; detail?: string
}

interface Props {
  task: TaskDrawerData
  onClose: () => void
  onComplete: (id: string) => void
}

const typeConfig: Record<TaskType, { icon: LucideIcon; color: string; label: string }> = {
  call: { icon: Phone, color: '#f97316', label: 'Ligação' },
  email: { icon: Mail, color: '#3b82f6', label: 'E-mail' },
  whatsapp: { icon: MessageCircle, color: '#25d166', label: 'WhatsApp' },
  meeting: { icon: Video, color: '#a855f7', label: 'Reunião' },
  visit: { icon: Handshake, color: '#f59e0b', label: 'Visita' },
  proposal: { icon: FileText, color: '#9ca3af', label: 'Proposta' },
  approve: { icon: ShieldCheck, color: '#22c55e', label: 'Liberar Pedido' },
}

const CSS = `
  @keyframes tdSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
  @keyframes tdFadeIn{from{opacity:0}to{opacity:1}}
  .td-body::-webkit-scrollbar{width:4px}.td-body::-webkit-scrollbar-track{background:transparent}
  .td-body::-webkit-scrollbar-thumb{background:#22283a;border-radius:4px}
  .td-body{scrollbar-width:thin;scrollbar-color:#22283a transparent}
`

export default function TaskDrawer({ task, onClose, onComplete }: Props) {
  const tc = typeConfig[task.type]
  const Icon = tc.icon

  return (
    <>
      <style>{CSS}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, animation: 'tdFadeIn 0.2s ease-out' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, width: 400, height: '100vh', background: '#161a22', borderLeft: '1px solid #22283a', zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'tdSlideIn 0.25s ease-out' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Tarefas → {tc.label}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${tc.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={tc.color} strokeWidth={1.5} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>{task.title}</h2>
                <div style={{ marginTop: 6 }}>
                  {task.done ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 600 }}>Concluída · {task.doneDate}</span>
                  ) : task.overdue ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 600 }}>Atrasada · {task.time}</span>
                  ) : task.time.includes('Aguardando') ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(249,115,22,0.12)', color: '#f97316', fontWeight: 600 }}>{task.time}</span>
                  ) : task.time ? (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Prazo: {task.time}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, flexShrink: 0 }}>
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="td-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {task.type === 'approve' ? (
            <ApproveContent task={task} onClose={onClose} onComplete={onComplete} />
          ) : (
            <CommonContent task={task} onClose={onClose} onComplete={onComplete} />
          )}
        </div>
      </div>
    </>
  )
}

// ── Common task content ──

function CommonContent({ task, onClose, onComplete }: { task: TaskDrawerData; onClose: () => void; onComplete: (id: string) => void }) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createNext, setCreateNext] = useState(false)

  function handleComplete() {
    if (!notes.trim()) { setError(true); return }
    setSaving(true)
    setTimeout(() => { onComplete(task.id); onClose() }, 800)
  }

  return (
    <>
      {/* Lead */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Lead vinculado</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#22283a', fontSize: 11, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{task.leadInitials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{task.leadName}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{task.leadCompany}</div>
          </div>
          <span style={{ background: `${task.stageColor}1F`, color: task.stageColor, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{task.stageBadge}</span>
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Detalhes</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: '#e8eaf0' }}>
          <Clock size={14} color="#6b7280" strokeWidth={1.5} />
          <span>Hoje · {task.time || '—'}</span>
          {task.calendarBadge && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Google Calendar</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e8eaf0' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{task.leadInitials.slice(0, 2)}</div>
          <span style={{ color: '#9ca3af' }}>Responsável: você</span>
        </div>
      </div>

      {/* Action */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Registrar resultado</div>
        <textarea rows={3} value={notes} onChange={e => { setNotes(e.target.value); setError(false) }}
          placeholder="O que aconteceu nessa interação?"
          style={{
            width: '100%', background: '#0f1117', borderRadius: 8, padding: 10, fontSize: 13, color: '#e8eaf0', outline: 'none', resize: 'none', boxSizing: 'border-box',
            border: `1px solid ${error ? '#ef4444' : '#22283a'}`,
          }} />
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#ef4444' }}>
            <AlertCircle size={12} strokeWidth={1.5} /> Registre o resultado antes de concluir
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#e8eaf0' }}>
            <input type="checkbox" checked={createNext} onChange={e => setCreateNext(e.target.checked)} style={{ accentColor: '#f97316' }} />
            Criar próxima tarefa automaticamente?
          </label>
        </div>
        {createNext && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select style={{ flex: 1, background: '#0f1117', border: '1px solid #22283a', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none' }}>
              <option>Ligação</option><option>E-mail</option><option>Reunião</option><option>WhatsApp</option>
            </select>
            <input type="date" style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none' }} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 16px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Remarcar</button>
        <button onClick={handleComplete} disabled={saving} style={{
          flex: 1, background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 0',
          fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Concluindo...</> : 'Concluir tarefa ✓'}
        </button>
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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Resumo do pedido</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow label="SOLICITANTE" avatar="AN" value="Ana Souza · Vendedora" />
          <InfoRow label="CLIENTE" avatar="CT" value="Camila Torres · Torres & Filhos" />
          <InfoRow label="PRODUTO" value="Plano Pro — Anual" />
          <InfoRow label="SOLICITADO" value="há 2 horas" />
        </div>
      </div>

      {/* S2 — Valores */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Valores</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <ValueCard label="Valor original" value="R$ 12.000" color="#e8eaf0" />
          <ValueCard label="Desconto" value="20%" color="#ef4444" />
          <ValueCard label="Valor final" value="R$ 9.600" color="#22c55e" />
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Economia para o cliente: <span style={{ color: '#f59e0b', fontWeight: 600 }}>R$ 2.400</span></div>
        <span style={{ display: 'inline-block', marginTop: 8, background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Acima do limite — máximo 15%</span>
      </div>

      {/* S3 — Justificativa */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Justificativa do vendedor</div>
        <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 12, fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
          "Cliente tem potencial de fechar anual se dermos 20%. Já negociamos por 3 semanas. Se não aprovar, perdemos para o concorrente."
        </div>
      </div>

      {/* S4 — Histórico do cliente */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Histórico do cliente</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <div><span style={{ color: '#6b7280' }}>Cliente desde: </span><span style={{ color: '#e8eaf0' }}>Jan/2025</span></div>
          <div><span style={{ color: '#6b7280' }}>Total comprado: </span><span style={{ color: '#22c55e', fontWeight: 700 }}>R$ 35.000</span></div>
          <div><span style={{ color: '#6b7280' }}>Última compra: </span><span style={{ color: '#e8eaf0' }}>Mar/2026 — Treinamento Equipe</span></div>
        </div>
      </div>

      {/* S5 — Observation + password */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Observação (opcional)</label>
          <textarea rows={2} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Observação sobre a aprovação..."
            style={{ width: '100%', background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 10, fontSize: 13, color: '#e8eaf0', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Senha do aprovador <span style={{ color: '#f97316' }}>*</span></label>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPwError(false) }} placeholder="Digite sua senha"
            style={{ width: '100%', background: '#0f1117', border: `1px solid ${pwError ? '#ef4444' : '#22283a'}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }} />
          {pwError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Digite a senha para confirmar</div>}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexShrink: 0, borderTop: '1px solid #22283a' }}>
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
      <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', width: 80, flexShrink: 0 }}>{label}</span>
      {avatar && <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#22283a', fontSize: 9, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatar}</div>}
      <span style={{ fontSize: 13, color: '#e8eaf0' }}>{value}</span>
    </div>
  )
}

function ValueCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}
