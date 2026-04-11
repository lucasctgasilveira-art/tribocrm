import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, MessageCircle, Mail, Phone, Calendar, UserPlus,
  Check, ExternalLink, Loader2, Pencil,
} from 'lucide-react'
import api from '../../../services/api'
import { SendEmailModal, ConnectGmailModal } from '../EmailModal/EmailModal'

// ── Types ──

export interface LeadData {
  id: string
  name: string
  company: string
  value: number
  stage: string
  temperature: 'HOT' | 'WARM' | 'COLD'
  responsible: string
  lastContact: string | null
  phone: string
  email: string
}

interface LeadDrawerProps {
  lead: LeadData
  onClose: () => void
  stageColor: string
  instance?: 'gestao' | 'vendas'
  onUpdate?: (leadId: string, changes: Partial<LeadData>) => void
}

interface Interaction {
  id: string
  type: string
  content: string
  createdAt: string
  isAuto: boolean
  user?: { id: string; name: string }
}

interface Task {
  id: string
  type: string
  title: string
  dueDate: string | null
  isDone: boolean
  doneAt: string | null
}

// ── Config ──

const tempConfig: Record<string, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

const typeIcons: Record<string, { color: string }> = {
  CALL: { color: '#f97316' },
  EMAIL: { color: '#3b82f6' },
  WHATSAPP: { color: '#25d166' },
  MEETING: { color: '#a855f7' },
  VISIT: { color: '#ec4899' },
  NOTE: { color: 'var(--text-muted)' },
  SYSTEM: { color: 'var(--text-muted)' },
  PROPOSAL: { color: '#f59e0b' },
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return `Hoje · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (days === 1) return `Ontem · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('pt-BR') + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

type Tab = 'history' | 'tasks' | 'info'

const CSS = `
  @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes drawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .drawer-body::-webkit-scrollbar { width: 4px; }
  .drawer-body::-webkit-scrollbar-track { background: transparent; }
  .drawer-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .drawer-body { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
`

// ── Component ──

export default function LeadDrawer({ lead, onClose, stageColor, instance = 'gestao', onUpdate }: LeadDrawerProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const [toast, setToast] = useState('')
  const [interactionModal, setInteractionModal] = useState(false)
  const [taskModal, setTaskModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [currentValue, setCurrentValue] = useState<number>(lead.value)
  const [editingValue, setEditingValue] = useState(false)
  const [valueDraft, setValueDraft] = useState<string>(String(lead.value ?? 0))
  const [savingValue, setSavingValue] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailNeedsConnect, setEmailNeedsConnect] = useState(false)
  const temp = tempConfig[lead.temperature] ?? tempConfig.COLD!

  useEffect(() => {
    setCurrentValue(lead.value)
    setValueDraft(String(lead.value ?? 0))
  }, [lead.id, lead.value])

  async function handleSaveValue() {
    const parsed = Number(valueDraft.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) { showToast('Valor inválido'); return }
    setSavingValue(true)
    try {
      await api.patch(`/leads/${lead.id}`, { expectedValue: parsed })
      setCurrentValue(parsed)
      setEditingValue(false)
      onUpdate?.(lead.id, { value: parsed })
      showToast('✅ Valor atualizado')
    } catch {
      showToast('Erro ao atualizar valor')
    } finally {
      setSavingValue(false)
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function cleanPhone(raw: string): string { return raw.replace(/\D/g, '') }

  function handleWhatsApp() {
    const num = cleanPhone(lead.phone)
    if (!num) { showToast('Lead sem WhatsApp cadastrado'); return }
    const full = num.length <= 11 ? `55${num}` : num
    window.open(`https://wa.me/${full}`, '_blank')
  }

  async function handleEmail() {
    if (!lead.email || lead.email === '—') { showToast('Lead sem e-mail cadastrado'); return }
    try {
      const { data } = await api.get('/oauth/google/status')
      if (data?.data?.connected) {
        setEmailOpen(true)
      } else {
        setEmailNeedsConnect(true)
      }
    } catch {
      setEmailNeedsConnect(true)
    }
  }

  function handleCall() {
    const num = cleanPhone(lead.phone)
    if (!num) { showToast('Lead sem telefone cadastrado'); return }
    window.open(`tel:${num}`)
  }

  function handleSchedule() {
    setTaskModal(true)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: 'Histórico' },
    { key: 'tasks', label: 'Tarefas' },
    { key: 'info', label: 'Informações' },
  ]

  return (
    <>
      <style>{CSS}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, animation: 'drawerFadeIn 0.2s ease-out' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, width: 420, height: '100vh', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'drawerSlideIn 0.25s ease-out' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Pipeline → {lead.stage}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{lead.name}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{lead.company}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button onClick={() => { onClose(); navigate(`/${instance}/leads/${lead.id}`) }} style={{ background: 'transparent', color: '#f97316', fontSize: 12, border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                Ver detalhes <ExternalLink size={11} strokeWidth={1.5} />
              </button>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={20} strokeWidth={1.5} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Badge bg={temp.bg} color={temp.color}>{temp.label}</Badge>
            <Badge bg={`${stageColor}1F`} color={stageColor}>{lead.stage}</Badge>
          </div>
        </div>

        {/* Value */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Valor</div>
          {editingValue ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>R$</span>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                value={valueDraft}
                onChange={e => setValueDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleSaveValue() }
                  if (e.key === 'Escape') { setEditingValue(false); setValueDraft(String(currentValue)) }
                }}
                disabled={savingValue}
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', outline: 'none', minWidth: 0 }}
              />
              <button onClick={handleSaveValue} disabled={savingValue}
                style={{ background: '#22c55e', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: savingValue ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                {savingValue ? <Loader2 size={14} color="#fff" className="animate-spin" /> : <Check size={14} color="#fff" strokeWidth={2} />}
              </button>
              <button onClick={() => { setEditingValue(false); setValueDraft(String(currentValue)) }} disabled={savingValue}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', cursor: savingValue ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(currentValue)}</div>
              <button onClick={() => { setValueDraft(String(currentValue)); setEditingValue(true) }}
                title="Editar valor"
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: 5, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <Pencil size={12} strokeWidth={1.5} />
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12 }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Responsável </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{lead.responsible}</span></div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <DrawerActionBtn icon={<MessageCircle size={18} strokeWidth={1.5} />} label="WhatsApp" color="#25d166" border="rgba(37,209,102,0.3)" onClick={handleWhatsApp} />
          <DrawerActionBtn icon={<Mail size={18} strokeWidth={1.5} />} label="E-mail" color="#3b82f6" border="rgba(59,130,246,0.3)" onClick={handleEmail} />
          <DrawerActionBtn icon={<Phone size={18} strokeWidth={1.5} />} label="Ligar" color="#f97316" border="rgba(249,115,22,0.3)" onClick={handleCall} />
          <DrawerActionBtn icon={<Calendar size={18} strokeWidth={1.5} />} label="Agendar" color="#a855f7" border="rgba(168,85,247,0.3)" onClick={handleSchedule} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 16px', fontSize: 13, color: isActive ? '#f97316' : 'var(--text-muted)', fontWeight: isActive ? 500 : 400, borderBottom: isActive ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' }}>
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="drawer-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeTab === 'history' && <HistoryTab leadId={lead.id} reloadKey={reloadKey} onAdd={() => setInteractionModal(true)} />}
          {activeTab === 'tasks' && <TasksTab leadId={lead.id} reloadKey={reloadKey} onAdd={() => setTaskModal(true)} />}
          {activeTab === 'info' && <InfoTab lead={lead} />}
        </div>

        {/* Toast */}
        {toast && <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>{toast}</div>}
      </div>

      {/* Modals */}
      {interactionModal && <NewInteractionModal leadId={lead.id} onClose={() => setInteractionModal(false)} onSaved={() => { setInteractionModal(false); setReloadKey(k => k + 1); showToast('Interação registrada') }} />}
      {taskModal && <NewTaskModal leadId={lead.id} onClose={() => setTaskModal(false)} onSaved={() => { setTaskModal(false); setReloadKey(k => k + 1); showToast('Tarefa criada'); setActiveTab('tasks') }} />}
      {emailOpen && <SendEmailModal lead={{ id: lead.id, name: lead.name, company: lead.company, email: lead.email }} onClose={() => setEmailOpen(false)} onSaved={() => { setEmailOpen(false); setReloadKey(k => k + 1); showToast('E-mail enviado') }} />}
      {emailNeedsConnect && <ConnectGmailModal onClose={() => setEmailNeedsConnect(false)} onNavigate={() => { setEmailNeedsConnect(false); onClose(); navigate(`/${instance}/configuracoes?tab=integracoes`) }} />}
    </>
  )
}

// ── HistoryTab (real data) ──

function HistoryTab({ leadId, reloadKey, onAdd }: { leadId: string; reloadKey: number; onAdd: () => void }) {
  const [items, setItems] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/leads/${leadId}/interactions`).then(r => setItems(r.data.data ?? [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [leadId, reloadKey])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} color="#f97316" className="animate-spin" /></div>

  return (
    <div style={{ padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <SmallBtn label="+ Registrar" onClick={onAdd} />
      </div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma interação registrada</div>
      ) : items.map((item) => {
        const tc = typeIcons[item.type] ?? typeIcons.NOTE!
        return (
          <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${tc.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TypeIcon type={item.type} color={tc.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.type}{item.isAuto ? ' (auto)' : ''}</div>
              {item.content && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.content}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatDate(item.createdAt)}{item.user ? ` · ${item.user.name}` : ''}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TypeIcon({ type, color }: { type: string; color: string }) {
  const size = 16; const sw = 1.5
  switch (type) {
    case 'CALL': return <Phone size={size} color={color} strokeWidth={sw} />
    case 'EMAIL': return <Mail size={size} color={color} strokeWidth={sw} />
    case 'WHATSAPP': return <MessageCircle size={size} color={color} strokeWidth={sw} />
    case 'MEETING': return <Calendar size={size} color={color} strokeWidth={sw} />
    default: return <UserPlus size={size} color={color} strokeWidth={sw} />
  }
}

// ── TasksTab (real data) ──

function TasksTab({ leadId, reloadKey, onAdd }: { leadId: string; reloadKey: number; onAdd: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/tasks', { params: { leadId, perPage: 20 } }).then(r => setTasks(r.data.data ?? [])).catch(() => setTasks([])).finally(() => setLoading(false))
  }, [leadId, reloadKey])

  async function toggleDone(id: string) {
    try {
      await api.patch(`/tasks/${id}/complete`)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: true, doneAt: new Date().toISOString() } : t))
    } catch { /* ignore */ }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} color="#f97316" className="animate-spin" /></div>

  return (
    <div style={{ padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <SmallBtn label="+ Adicionar tarefa" onClick={onAdd} />
      </div>
      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma tarefa</div>
      ) : tasks.map((task) => {
        return (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: task.isDone ? 0.5 : 1 }}>
            <div onClick={() => { if (!task.isDone) toggleDone(task.id) }} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: task.isDone ? 'none' : '1px solid var(--border)', background: task.isDone ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: task.isDone ? 'default' : 'pointer' }}>
              {task.isDone && <Check size={12} color="#fff" strokeWidth={2.5} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: task.isDone ? 'line-through' : 'none' }}>{task.title}</div>
              <div style={{ fontSize: 11, color: task.isDone ? '#22c55e' : 'var(--text-muted)', marginTop: 2 }}>
                {task.isDone ? 'Concluída' : task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── InfoTab ──

function InfoTab({ lead }: { lead: LeadData }) {
  const fields = [
    { label: 'E-mail', value: lead.email },
    { label: 'Telefone', value: lead.phone },
    { label: 'Responsável', value: lead.responsible },
  ]
  return (
    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {fields.map((f) => (
        <div key={f.label}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{f.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── New Interaction Modal ──

function NewInteractionModal({ leadId, onClose, onSaved }: { leadId: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('CALL')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const canSave = content.trim().length > 0 && !saving
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await api.post(`/leads/${leadId}/interactions`, { type, content })
      onSaved()
    } catch { setSaving(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Registrar interação</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="CALL">Ligação</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="MEETING">Reunião</option>
              <option value="VISIT">Visita</option>
              <option value="NOTE">Nota</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Descrição *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="Descreva a interação..." style={{ ...inputS, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Salvando...' : 'Registrar'}</button>
        </div>
      </div>
    </>
  )
}

// ── New Task Modal ──

function NewTaskModal({ leadId, onClose, onSaved }: { leadId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('CALL')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const canSave = title.trim().length > 0 && dueDate && !saving
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await api.post('/tasks', { leadId, title, type, dueDate, description: description.trim() || undefined })
      onSaved()
    } catch { setSaving(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nova tarefa</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Título *</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Ligar para follow-up" style={inputS} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                <option value="CALL">Ligação</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">E-mail</option>
                <option value="MEETING">Reunião</option>
                <option value="VISIT">Visita</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Vencimento *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputS} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Detalhes da tarefa..." style={{ ...inputS, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Salvando...' : 'Criar tarefa'}</button>
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span style={{ background: bg, color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{children}</span>
}

function DrawerActionBtn({ icon, label, color, border, onClick }: { icon: React.ReactNode; label: string; color: string; border: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 8, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color, cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}0D` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      {icon}
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  )
}

function SmallBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}>
      {label}
    </button>
  )
}
