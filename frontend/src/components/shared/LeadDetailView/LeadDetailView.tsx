import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  MessageCircle, Mail, Phone, Calendar, FileText,
  UserPlus, Video, Check, Package, ChevronLeft, Loader2, X,
} from 'lucide-react'
import type { SidebarEntry } from '../Sidebar/Sidebar'
import AppLayout from '../AppLayout/AppLayout'
import { SendEmailModal, ConnectGmailModal } from '../EmailModal/EmailModal'
import { getLead } from '../../../services/leads.service'
import api from '../../../services/api'
import { notifyExtensionPhoneHint } from '../../../utils/extensionBridge'

// ── Config ──

const tempConfig: Record<string, { label: string; color: string; bg: string }> = {
  HOT: { label: 'Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: 'Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: 'Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatDateTime(d: string) {
  const dt = new Date(d)
  return `${dt.toLocaleDateString('pt-BR')} · ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

const interactionIcons: Record<string, { icon: typeof Mail; color: string }> = {
  EMAIL: { icon: Mail, color: '#3b82f6' },
  CALL: { icon: Phone, color: '#f97316' },
  WHATSAPP: { icon: MessageCircle, color: '#25d166' },
  MEETING: { icon: Video, color: '#a855f7' },
  NOTE: { icon: FileText, color: 'var(--text-secondary)' },
  SYSTEM: { icon: UserPlus, color: 'var(--text-muted)' },
}

// ── Props ──

interface LeadDetailViewProps {
  menuItems: SidebarEntry[]
  instance: 'gestao' | 'vendas'
}

// ── Component ──

export default function LeadDetailView({ menuItems, instance }: LeadDetailViewProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rightTab, setRightTab] = useState<'tasks' | 'products' | 'notes'>('tasks')
  const [editOpen, setEditOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailNeedsConnect, setEmailNeedsConnect] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  function reload() { setReloadKey(k => k + 1) }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getLead(id)
      .then(d => { setLead(d) })
      .catch(err => { console.error('[LeadDetail] Error loading lead:', err); setLead(null) })
      .finally(() => setLoading(false))
  }, [id, reloadKey])

  if (loading) {
    return (
      <AppLayout menuItems={menuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando lead...</span>
        </div>
      </AppLayout>
    )
  }

  if (!lead) {
    return (
      <AppLayout menuItems={menuItems}>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Lead não encontrado.
          <div style={{ marginTop: 12 }}>
            <button onClick={() => navigate(`/${instance}/pipeline`)} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Voltar ao Pipeline</button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const temp = tempConfig[lead.temperature] ?? tempConfig.COLD!
  const stageColor = lead.stage?.color ?? 'var(--text-muted)'
  const stageName = lead.stage?.name ?? '—'
  const respName = lead.responsible?.name ?? '—'
  const initials = (lead.name ?? '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  function openWhatsApp() {
    const phone = (lead.whatsapp || lead.phone || '').replace(/\D/g, '')
    if (phone) {
      const full = phone.length <= 11 ? `55${phone}` : phone
      // Notifica a extensao Chrome (se instalada) via runtime.sendMessage.
      void notifyExtensionPhoneHint({ phone: full, leadId: lead.id })
      window.open(`https://wa.me/${full}`, '_blank')
      api.post(`/leads/${id}/interactions`, { type: 'WHATSAPP', notes: 'Contato via WhatsApp' }).catch(() => {})
    }
  }

  function openPhone() {
    const phone = (lead.phone || lead.whatsapp || '').replace(/\D/g, '')
    if (phone) {
      window.open(`tel:${phone}`)
      api.post(`/leads/${id}/interactions`, { type: 'CALL', notes: 'Ligação realizada' }).catch(() => {})
    }
  }

  async function openEmail() {
    if (!lead.email) { return }
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

  const ghost: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }

  return (
    <AppLayout menuItems={menuItems}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate(`/${instance}/pipeline`)} style={{ ...ghost }}>
            <ChevronLeft size={14} strokeWidth={1.5} /> Pipeline
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>›</span>
          <span style={{ fontSize: 12, color: stageColor }}>{stageName}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>›</span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{lead.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setEditOpen(true)} style={ghost}>Editar</button>
          <button onClick={() => setLostOpen(true)} style={{ ...ghost, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>Mover para Perdido</button>
          <button style={{ background: '#22c55e', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={14} strokeWidth={2} /> Venda Realizada
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{lead.name}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{lead.company ?? '—'}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Badge bg={temp.bg} color={temp.color}>{temp.label}</Badge>
              <Badge bg={`${stageColor}1F`} color={stageColor}>{stageName}</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Criado em {formatDate(lead.createdAt)}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>Valor estimado</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#f97316', marginTop: 2 }}>{fmt(Number(lead.expectedValue) || 0)}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <ActBtn icon={<MessageCircle size={16} strokeWidth={1.5} />} label="WhatsApp" color="#25d166" border="rgba(37,209,102,0.3)" onClick={openWhatsApp} />
        <ActBtn icon={<Mail size={16} strokeWidth={1.5} />} label="Enviar E-mail" color="#3b82f6" border="rgba(59,130,246,0.3)" onClick={openEmail} />
        <ActBtn icon={<Phone size={16} strokeWidth={1.5} />} label="Ligar" color="#f97316" border="rgba(249,115,22,0.3)" onClick={openPhone} />
        <ActBtn icon={<Calendar size={16} strokeWidth={1.5} />} label="Agendar" color="var(--text-secondary)" border="var(--border)" />
        <ActBtn icon={<FileText size={16} strokeWidth={1.5} />} label="Proposta" color="var(--text-secondary)" border="var(--border)" />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Contact info */}
          <Section title="Informações do contato">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InfoField label="E-mail" value={lead.email ?? '—'} valueColor={lead.email ? '#3b82f6' : undefined} />
              <InfoField label="Telefone / WhatsApp" value={lead.phone ?? lead.whatsapp ?? '—'} />
              <InfoField label="Empresa" value={lead.company ?? '—'} />
              <InfoField label="Responsável" value={respName} />
              <InfoField label="Fonte" value={lead.source ?? '—'} />
              <InfoField label="Criado em" value={formatDate(lead.createdAt)} />
            </div>
          </Section>

          {/* History */}
          <Section title="Histórico de interações">
            {lead.interactions?.length ? (
              <div>
                {lead.interactions.map((item: any, i: number) => {
                  const cfg = interactionIcons[item.type] ?? interactionIcons.SYSTEM!
                  const Icon = cfg.icon
                  return (
                    <div key={item.id ?? i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < lead.interactions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cfg.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} color={cfg.color} strokeWidth={1.5} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.type}</div>
                        {item.content && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{item.content}</div>}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatDateTime(item.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma interação registrada</div>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div style={{ width: 360, flexShrink: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            {([['tasks', 'Tarefas'], ['products', 'Produtos'], ['notes', 'Notas']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setRightTab(key)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13, color: rightTab === key ? '#f97316' : 'var(--text-muted)', fontWeight: rightTab === key ? 500 : 400, borderBottom: rightTab === key ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {rightTab === 'tasks' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              {lead.tasks?.length ? lead.tasks.map((t: any, i: number) => {
                const tCfg = interactionIcons[t.type] ?? { icon: Phone, color: '#f97316' }
                const TIcon = tCfg.icon
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < lead.tasks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: `${tCfg.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <TIcon size={14} color={tCfg.color} strokeWidth={1.5} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.dueDate ? formatDate(t.dueDate) : '—'}</div>
                    </div>
                  </div>
                )
              }) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma tarefa pendente</div>
              )}
            </div>
          )}
          {rightTab === 'products' && <EmptyState icon={<Package size={32} color="var(--text-muted)" strokeWidth={1.5} />} text="Nenhum produto vinculado" btnLabel="+ Vincular produto" />}
          {rightTab === 'notes' && <EmptyState icon={<FileText size={32} color="var(--text-muted)" strokeWidth={1.5} />} text="Nenhuma nota ainda" btnLabel="+ Adicionar nota" onClick={() => setNoteOpen(true)} />}
        </div>
      </div>

      {editOpen && <EditLeadModal lead={lead} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); reload() }} />}
      {lostOpen && <MoveToLostModal lead={lead} onClose={() => setLostOpen(false)} onSaved={() => { setLostOpen(false); reload() }} />}
      {noteOpen && <AddNoteModal leadId={lead.id} onClose={() => setNoteOpen(false)} onSaved={() => { setNoteOpen(false); reload() }} />}
      {emailOpen && <SendEmailModal lead={lead} onClose={() => setEmailOpen(false)} onSaved={() => { setEmailOpen(false); reload() }} />}
      {emailNeedsConnect && <ConnectGmailModal onClose={() => setEmailNeedsConnect(false)} onNavigate={() => { setEmailNeedsConnect(false); navigate(`/${instance}/configuracoes?tab=integracoes`) }} />}
    </AppLayout>
  )
}

// ── Sub-components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function InfoField({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 13, color: valueColor ?? 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span style={{ background: bg, color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{children}</span>
}

function ActBtn({ icon, label, color, border, onClick }: { icon: React.ReactNode; label: string; color: string; border: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color, cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}0D` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      {icon} {label}
    </button>
  )
}

function EmptyState({ icon, text, btnLabel, onClick }: { icon: React.ReactNode; text: string; btnLabel: string; onClick?: () => void }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {icon}
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
      <button onClick={onClick} style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{btnLabel}</button>
    </div>
  )
}

// ── Modal primitives ──

const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }
const modalBox: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const labelS: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }

function ModalShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={modalOverlay} />
      <div style={modalBox}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>{footer}</div>
      </div>
    </>
  )
}

// ── Edit Lead Modal ──

function EditLeadModal({ lead, onClose, onSaved }: { lead: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(lead.name ?? '')
  const [company, setCompany] = useState(lead.company ?? '')
  const [email, setEmail] = useState(lead.email ?? '')
  const [phone, setPhone] = useState(lead.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp ?? '')
  const [expectedValue, setExpectedValue] = useState(lead.expectedValue ? String(lead.expectedValue) : '')
  const [temperature, setTemperature] = useState(lead.temperature ?? 'WARM')
  const [source, setSource] = useState(lead.source ?? '')
  const [position, setPosition] = useState(lead.position ?? '')
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.patch(`/leads/${lead.id}`, {
        name: name.trim(),
        company: company || null,
        email: email || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        expectedValue: expectedValue ? Number(expectedValue) : null,
        temperature,
        source: source || null,
        position: position || null,
        notes: notes || null,
      })
      onSaved()
    } catch {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Editar lead" onClose={onClose} footer={
      <>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} style={{ background: saving || !name.trim() ? 'var(--border)' : '#f97316', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving || !name.trim() ? 'not-allowed' : 'pointer' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelS}>Nome *</label><input value={name} onChange={e => setName(e.target.value)} style={inputS} /></div>
        <div><label style={labelS}>Empresa</label><input value={company} onChange={e => setCompany(e.target.value)} style={inputS} /></div>
        <div><label style={labelS}>Cargo</label><input value={position} onChange={e => setPosition(e.target.value)} style={inputS} /></div>
        <div><label style={labelS}>E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} style={inputS} /></div>
        <div><label style={labelS}>Telefone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputS} /></div>
        <div><label style={labelS}>WhatsApp</label><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inputS} /></div>
        <div><label style={labelS}>Valor estimado</label><input value={expectedValue} onChange={e => setExpectedValue(e.target.value.replace(/[^0-9.]/g, ''))} style={inputS} placeholder="0" /></div>
        <div><label style={labelS}>Temperatura</label>
          <select value={temperature} onChange={e => setTemperature(e.target.value)} style={{ ...inputS, cursor: 'pointer' }}>
            <option value="HOT">Quente</option>
            <option value="WARM">Morno</option>
            <option value="COLD">Frio</option>
          </select>
        </div>
        <div><label style={labelS}>Fonte</label><input value={source} onChange={e => setSource(e.target.value)} style={inputS} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelS}>Anotações</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputS, resize: 'vertical' }} /></div>
      </div>
    </ModalShell>
  )
}

// ── Move to Lost Modal ──

function MoveToLostModal({ lead, onClose, onSaved }: { lead: any; onClose: () => void; onSaved: () => void }) {
  const [reasons, setReasons] = useState<{ id: string; name: string }[]>([])
  const [lossReasonId, setLossReasonId] = useState('')
  const [lostStageId, setLostStageId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [reasonsRes, kanbanRes] = await Promise.all([
          api.get('/leads/loss-reasons'),
          api.get(`/pipelines/${lead.pipelineId}/kanban`),
        ])
        setReasons(reasonsRes.data.data ?? [])
        const stages = kanbanRes.data?.data?.stages ?? []
        const lost = stages.find((s: any) => s.type === 'LOST')
        setLostStageId(lost?.id ?? null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [lead.pipelineId])

  async function handleSave() {
    if (!lossReasonId || !lostStageId) return
    setSaving(true)
    try {
      await api.patch(`/leads/${lead.id}`, {
        status: 'LOST',
        lossReasonId,
        stageId: lostStageId,
        lostAt: new Date().toISOString(),
      })
      onSaved()
    } catch {
      setSaving(false)
    }
  }

  const canSave = !!lossReasonId && !!lostStageId && !saving

  return (
    <ModalShell title="Mover para Perdido" onClose={onClose} footer={
      <>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? '#ef4444' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Salvando...' : 'Confirmar'}</button>
      </>
    }>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
      ) : !lostStageId ? (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
          Este pipeline não tem uma etapa de tipo "Perdido". Configure o pipeline primeiro.
        </div>
      ) : (
        <div>
          <label style={labelS}>Motivo da perda *</label>
          <select value={lossReasonId} onChange={e => setLossReasonId(e.target.value)} style={{ ...inputS, cursor: 'pointer' }}>
            <option value="">Selecione um motivo</option>
            {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {reasons.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Nenhum motivo cadastrado. Cadastre em Configurações.</div>
          )}
        </div>
      )}
    </ModalShell>
  )
}

// ── Add Note Modal ──

function AddNoteModal({ leadId, onClose, onSaved }: { leadId: string; onClose: () => void; onSaved: () => void }) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const canSave = content.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await api.post(`/leads/${leadId}/interactions`, { type: 'NOTE', content, description: content })
      onSaved()
    } catch {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Adicionar nota" onClose={onClose} footer={
      <>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </>
    }>
      <label style={labelS}>Nota *</label>
      <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Escreva sua nota..." style={{ ...inputS, resize: 'vertical' }} autoFocus />
    </ModalShell>
  )
}

