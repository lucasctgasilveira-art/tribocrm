import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  MessageCircle, Mail, Phone, Calendar, FileText, MoreHorizontal,
  UserPlus, Video, Check, Package, ChevronLeft, Loader2,
} from 'lucide-react'
import type { SidebarEntry } from '../Sidebar/Sidebar'
import AppLayout from '../AppLayout/AppLayout'
import { getLead } from '../../../services/leads.service'
import api from '../../../services/api'

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

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getLead(id)
      .then(d => { console.log('[LeadDetail] loaded:', d); setLead(d) })
      .catch(err => { console.error('[LeadDetail] Error loading lead:', err); setLead(null) })
      .finally(() => setLoading(false))
  }, [id])

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
      window.open(`https://wa.me/${phone}`, '_blank')
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

  function openEmail() {
    if (lead.email) window.open(`mailto:${lead.email}`)
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
          <button style={ghost}>Editar</button>
          <button style={{ ...ghost, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>Mover para Perdido</button>
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
        <button style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <MoreHorizontal size={16} strokeWidth={1.5} />
        </button>
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
                        {item.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{item.notes}</div>}
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
          {rightTab === 'notes' && <EmptyState icon={<FileText size={32} color="var(--text-muted)" strokeWidth={1.5} />} text="Nenhuma nota ainda" btnLabel="+ Adicionar nota" />}
        </div>
      </div>
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

function EmptyState({ icon, text, btnLabel }: { icon: React.ReactNode; text: string; btnLabel: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {icon}
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
      <button style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{btnLabel}</button>
    </div>
  )
}
