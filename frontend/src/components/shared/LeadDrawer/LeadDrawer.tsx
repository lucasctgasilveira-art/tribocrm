import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, MessageCircle, Mail, Phone, Calendar, UserPlus, Video,
  Check, ExternalLink,
} from 'lucide-react'

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
}

// ── Config ──

const tempConfig: Record<string, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

type Tab = 'history' | 'tasks' | 'info'

const CSS = `
  @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes drawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .drawer-body::-webkit-scrollbar { width: 4px; }
  .drawer-body::-webkit-scrollbar-track { background: transparent; }
  .drawer-body::-webkit-scrollbar-thumb { background: #22283a; border-radius: 4px; }
  .drawer-body { scrollbar-width: thin; scrollbar-color: #22283a transparent; }
`

// ── Component ──

export default function LeadDrawer({ lead, onClose, stageColor, instance = 'gestao' }: LeadDrawerProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const temp = tempConfig[lead.temperature] ?? tempConfig.COLD!

  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: 'Histórico' },
    { key: 'tasks', label: 'Tarefas' },
    { key: 'info', label: 'Informações' },
  ]

  return (
    <>
      <style>{CSS}</style>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, animation: 'drawerFadeIn 0.2s ease-out' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, width: 420, height: '100vh',
        background: '#161a22', borderLeft: '1px solid #22283a', zIndex: 51,
        display: 'flex', flexDirection: 'column',
        animation: 'drawerSlideIn 0.25s ease-out',
      }}>

        {/* S1 — Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Pipeline → {lead.stage}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>{lead.name}</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{lead.company}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => { onClose(); navigate(`/${instance}/leads/${lead.id}`) }}
                style={{ background: 'transparent', color: '#f97316', fontSize: 12, border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                Ver detalhes <ExternalLink size={11} strokeWidth={1.5} />
              </button>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Badge bg={temp.bg} color={temp.color}>{temp.label}</Badge>
            <Badge bg={`${stageColor}1F`} color={stageColor}>{lead.stage}</Badge>
            <Badge bg="rgba(34,197,94,0.12)" color="#22c55e">Score 88</Badge>
          </div>
        </div>

        {/* S2 — Value + quick info */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #22283a', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Valor estimado</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', marginTop: 2 }}>{formatCurrency(lead.value)}</div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12 }}>
            <div>
              <span style={{ color: '#6b7280' }}>Responsável </span>
              <span style={{ color: '#e8eaf0', fontWeight: 500 }}>{lead.responsible}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Fonte </span>
              <span style={{ color: '#e8eaf0', fontWeight: 500 }}>Instagram</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Criado </span>
              <span style={{ color: '#e8eaf0', fontWeight: 500 }}>12/01/2026</span>
            </div>
          </div>
        </div>

        {/* S3 — Action buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderBottom: '1px solid #22283a', flexShrink: 0 }}>
          <ActionBtn icon={<MessageCircle size={18} strokeWidth={1.5} />} label="WhatsApp" color="#25d166" border="rgba(37,209,102,0.3)" />
          <ActionBtn icon={<Mail size={18} strokeWidth={1.5} />} label="E-mail" color="#3b82f6" border="rgba(59,130,246,0.3)" />
          <ActionBtn icon={<Phone size={18} strokeWidth={1.5} />} label="Ligar" color="#f97316" border="rgba(249,115,22,0.3)" />
          <ActionBtn icon={<Calendar size={18} strokeWidth={1.5} />} label="Agendar" color="#a855f7" border="rgba(168,85,247,0.3)" />
        </div>

        {/* S4 — Tabs */}
        <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #22283a', flexShrink: 0 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '12px 16px', fontSize: 13,
                  color: isActive ? '#f97316' : '#6b7280',
                  fontWeight: isActive ? 500 : 400,
                  borderBottom: isActive ? '2px solid #f97316' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content — scrollable */}
        <div className="drawer-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'info' && <InfoTab lead={lead} />}
        </div>
      </div>
    </>
  )
}

// ── Tabs ──

function HistoryTab() {
  const items = [
    {
      icon: Mail, iconColor: '#3b82f6', type: 'E-mail enviado',
      title: 'Proposta comercial enviada',
      badges: [{ text: 'Aberto 3x', bg: 'rgba(34,197,94,0.12)', color: '#22c55e' }, { text: 'Clicou na proposta', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' }],
      date: 'Hoje · 09:15 · Ana Souza',
    },
    {
      icon: Phone, iconColor: '#f97316', type: 'Ligação realizada',
      note: 'Cliente demonstrou interesse alto. Pediu proposta para fechar no plano anual.',
      date: 'Ontem · 14:30 · Ana Souza',
    },
    {
      icon: MessageCircle, iconColor: '#25d166', type: 'WhatsApp',
      note: 'Primeiro contato — cliente respondeu e demonstrou interesse.',
      date: '12/01/2026 · 10:00 · Ana Souza',
    },
    {
      icon: UserPlus, iconColor: '#6b7280', type: 'Lead criado',
      note: 'Lead captado via Instagram · atribuído via round-robin',
      date: '12/01/2026 · 09:00 · Sistema',
    },
  ]

  return (
    <div style={{ padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <SmallBtn label="+ Registrar" />
      </div>
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < items.length - 1 ? '1px solid #22283a' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.iconColor}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={16} color={item.iconColor} strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{item.title ?? item.type}</div>
              {item.badges && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {item.badges.map((b) => (
                    <span key={b.text} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: b.bg, color: b.color, fontWeight: 500 }}>{b.text}</span>
                  ))}
                </div>
              )}
              {item.note && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.note}</div>}
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{item.date}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TasksTab() {
  const tasks = [
    { icon: Phone, iconColor: '#f97316', title: 'Follow-up sobre desconto', due: 'Vence hoje · 14:00', dueColor: '#f59e0b', done: false },
    { icon: Video, iconColor: '#a855f7', title: 'Demo ao vivo para o time', due: '25/03/2026 · 10:00', dueColor: '#9ca3af', done: false, badge: 'Google Calendar' },
    { icon: Mail, iconColor: '#3b82f6', title: 'Enviar material de apresentação', due: 'Concluída · 13/03', dueColor: '#22c55e', done: true },
  ]

  return (
    <div style={{ padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <SmallBtn label="+ Adicionar tarefa" />
      </div>
      {tasks.map((task, i) => {
        const Icon = task.icon
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < tasks.length - 1 ? '1px solid #22283a' : 'none', opacity: task.done ? 0.5 : 1 }}>
            {/* Checkbox */}
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              border: task.done ? 'none' : '1px solid #22283a',
              background: task.done ? '#22c55e' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {task.done && <Check size={12} color="#fff" strokeWidth={2.5} />}
            </div>
            {/* Icon */}
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `${task.iconColor}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={14} color={task.iconColor} strokeWidth={1.5} />
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0', textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: task.dueColor }}>{task.due}</span>
                {task.badge && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{task.badge}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InfoTab({ lead }: { lead: LeadData }) {
  const fields = [
    { label: 'E-mail', value: lead.email },
    { label: 'Telefone / WhatsApp', value: lead.phone },
    { label: 'CPF', value: '***.456.789-**' },
    { label: 'Fonte do lead', value: 'Instagram' },
    { label: 'Responsável', value: lead.responsible },
    { label: 'Data de criação', value: '12/01/2026' },
  ]

  return (
    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {fields.map((f) => (
        <div key={f.label}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</div>
          <div style={{ fontSize: 13, color: '#e8eaf0', marginTop: 2 }}>{f.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Sub-components ──

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{ background: bg, color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>
      {children}
    </span>
  )
}

function ActionBtn({ icon, label, color, border }: { icon: React.ReactNode; label: string; color: string; border: string }) {
  return (
    <button style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: 8, borderRadius: 8, border: `1px solid ${border}`,
      background: 'transparent', color, cursor: 'pointer', transition: 'background 0.15s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}0D` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  )
}

function SmallBtn({ label }: { label: string }) {
  return (
    <button style={{
      background: '#f97316', color: '#fff', border: 'none', borderRadius: 6,
      padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      transition: 'background 0.15s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}
    >
      {label}
    </button>
  )
}
