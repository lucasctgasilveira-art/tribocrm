import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  MessageCircle, Mail, Phone, Calendar, FileText, MoreHorizontal,
  UserPlus, Video, Check, Package, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { LeadData } from '../LeadDrawer/LeadDrawer'
import type { SidebarEntry } from '../Sidebar/Sidebar'
import AppLayout from '../AppLayout/AppLayout'

// ── Config ──

interface StageConfig { name: string; color: string }

const stages: StageConfig[] = [
  { name: 'Sem Contato', color: '#6b7280' },
  { name: 'Em Contato', color: '#3b82f6' },
  { name: 'Negociando', color: '#f59e0b' },
  { name: 'Proposta Enviada', color: '#a855f7' },
  { name: 'Venda Realizada', color: '#22c55e' },
  { name: 'Repescagem', color: '#f97316' },
  { name: 'Perdido', color: '#ef4444' },
]

const tempConfig: Record<string, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

// ── Mock leads (same as pipeline) ──

const allLeads: LeadData[] = [
  { id:'1', name:'Camila Torres', company:'Torres & Filhos', value:12000, stage:'Sem Contato', temperature:'HOT', responsible:'AN', lastContact:'há 2 dias', phone:'(21) 98712-3344', email:'camila@torres.com' },
  { id:'2', name:'Rafael Mendes', company:'MendesNet', value:8500, stage:'Sem Contato', temperature:'COLD', responsible:'PG', lastContact:'há 8 dias', phone:'(11) 97654-3210', email:'rafael@mendesnet.com' },
  { id:'3', name:'Pedro Alves', company:'Alves Tech', value:5000, stage:'Sem Contato', temperature:'WARM', responsible:'LC', lastContact:'há 3 dias', phone:'(21) 96543-2109', email:'pedro@alves.com' },
  { id:'4', name:'Fernanda Lima', company:'Lima Distribuidora', value:18000, stage:'Em Contato', temperature:'HOT', responsible:'AN', lastContact:'hoje', phone:'(31) 95432-1098', email:'fernanda@lima.com' },
  { id:'5', name:'Marcos Oliveira', company:'MO Serviços', value:5000, stage:'Em Contato', temperature:'COLD', responsible:'PG', lastContact:'há 18 dias', phone:'(41) 94321-0987', email:'marcos@mo.com' },
  { id:'6', name:'Juliana Costa', company:'Costa Digital', value:9500, stage:'Em Contato', temperature:'WARM', responsible:'MR', lastContact:'há 4 dias', phone:'(51) 93210-9876', email:'juliana@costa.com' },
  { id:'7', name:'Roberto Souza', company:'RS Comércio', value:32000, stage:'Negociando', temperature:'HOT', responsible:'AN', lastContact:'há 1 dia', phone:'(21) 92109-8765', email:'roberto@rs.com' },
  { id:'8', name:'Ana Paula Costa', company:'Costa & Filhos', value:12000, stage:'Negociando', temperature:'WARM', responsible:'LC', lastContact:'há 5 dias', phone:'(11) 91098-7654', email:'ana@costa.com' },
  { id:'9', name:'Thiago Bastos', company:'Bastos & Co', value:7500, stage:'Negociando', temperature:'COLD', responsible:'TB', lastContact:'há 7 dias', phone:'(21) 90987-6543', email:'thiago@bastos.com' },
  { id:'10', name:'Priscila Gomes', company:'GomesTech', value:28000, stage:'Proposta Enviada', temperature:'HOT', responsible:'PG', lastContact:'há 2 dias', phone:'(11) 89876-5432', email:'priscila@gomestech.com' },
  { id:'11', name:'Diego Marques', company:'Marquesali', value:15000, stage:'Proposta Enviada', temperature:'WARM', responsible:'AN', lastContact:'há 3 dias', phone:'(31) 88765-4321', email:'diego@marquesali.com' },
  { id:'12', name:'Juliana Torres', company:'Torres Import', value:28000, stage:'Venda Realizada', temperature:'HOT', responsible:'LC', lastContact:'hoje', phone:'(21) 87654-3210', email:'juliana@torres.com' },
  { id:'13', name:'Bruno Salave', company:'SalaGroup', value:19000, stage:'Repescagem', temperature:'WARM', responsible:'MR', lastContact:'há 12 dias', phone:'(41) 86543-2109', email:'bruno@sala.com' },
  { id:'14', name:'Carla Mendes', company:'Mendes Soluções', value:6000, stage:'Perdido', temperature:'COLD', responsible:'TB', lastContact:'há 20 dias', phone:'(51) 85432-1098', email:'carla@mendes.com' },
  { id:'15', name:'Lucas Ferreira', company:'Ferreira & Cia', value:22000, stage:'Em Contato', temperature:'HOT', responsible:'PG', lastContact:'há 1 dia', phone:'(21) 84321-0987', email:'lucas@ferreira.com' },
]

const responsibleNames: Record<string, string> = {
  AN: 'Ana Souza', PG: 'Pedro Gomes', LC: 'Lucas Castro', MR: 'Mariana Reis', TB: 'Thiago Bastos', EU: 'Você',
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
  const [rightTab, setRightTab] = useState<'tasks' | 'products' | 'notes'>('tasks')

  const lead = allLeads.find((l) => l.id === id)
  if (!lead) {
    return (
      <AppLayout menuItems={menuItems}>
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Lead não encontrado.</div>
      </AppLayout>
    )
  }

  const temp = tempConfig[lead.temperature] ?? tempConfig.COLD!
  const stageObj = stages.find((s) => s.name === lead.stage)
  const stageColor = stageObj?.color ?? '#6b7280'
  const respName = responsibleNames[lead.responsible] ?? lead.responsible

  // Prev/Next within same stage
  const sameStage = allLeads.filter((l) => l.stage === lead.stage)
  const idx = sameStage.findIndex((l) => l.id === lead.id)
  const prevLead = idx > 0 ? sameStage[idx - 1] : null
  const nextLead = idx < sameStage.length - 1 ? sameStage[idx + 1] : null

  const ghost: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }

  return (
    <AppLayout menuItems={menuItems}>
      {/* Breadcrumb + nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }} onClick={() => navigate(`/${instance}/pipeline`)}>Pipeline</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>›</span>
          <span style={{ fontSize: 12, color: stageColor }}>{lead.stage}</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>›</span>
          <span style={{ fontSize: 12, color: '#e8eaf0' }}>{lead.name}</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            <button disabled={!prevLead} onClick={() => prevLead && navigate(`/${instance}/leads/${prevLead.id}`)}
              style={{ ...ghost, opacity: prevLead ? 1 : 0.4, cursor: prevLead ? 'pointer' : 'not-allowed' }}>
              <ChevronLeft size={14} strokeWidth={1.5} /> Anterior
            </button>
            <button disabled={!nextLead} onClick={() => nextLead && navigate(`/${instance}/leads/${nextLead.id}`)}
              style={{ ...ghost, opacity: nextLead ? 1 : 0.4, cursor: nextLead ? 'pointer' : 'not-allowed' }}>
              Próximo <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={ghost}>Editar</button>
          <button style={ghost}>Duplicar</button>
          <button style={{ ...ghost, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>Mover para Perdido</button>
          <button style={{ background: '#22c55e', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={14} strokeWidth={2} /> Venda Realizada
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid #22283a' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>{lead.name}</h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>{lead.company}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Badge bg={temp.bg} color={temp.color}>{temp.label}</Badge>
              <Badge bg={`${stageColor}1F`} color={stageColor}>{lead.stage}</Badge>
              <Badge bg="rgba(34,197,94,0.12)" color="#22c55e">Score 88</Badge>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              Última interação {lead.lastContact ?? '—'} · Criado em 12/01/2026
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '2px' }}>Valor estimado</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#f97316', marginTop: 2 }}>{fmt(lead.value)}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Plano Pro · anual</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <ActBtn icon={<MessageCircle size={16} strokeWidth={1.5} />} label="WhatsApp" color="#25d166" border="rgba(37,209,102,0.3)" />
        <ActBtn icon={<Mail size={16} strokeWidth={1.5} />} label="Enviar E-mail" color="#3b82f6" border="rgba(59,130,246,0.3)" />
        <ActBtn icon={<Phone size={16} strokeWidth={1.5} />} label="Ligar" color="#f97316" border="rgba(249,115,22,0.3)" />
        <ActBtn icon={<Calendar size={16} strokeWidth={1.5} />} label="Agendar" color="#9ca3af" border="#22283a" />
        <ActBtn icon={<FileText size={16} strokeWidth={1.5} />} label="Proposta" color="#9ca3af" border="#22283a" />
        <button style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
          <MoreHorizontal size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Contact info */}
          <Section title="Informações do contato" action="Editar">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="E-mail" value={lead.email} valueColor="#3b82f6" />
              <Field label="Telefone / WhatsApp" value={lead.phone} />
              <Field label="CPF" value="***.456.789-**" />
              <Field label="Fonte do lead" value="Instagram" />
              <Field label="Responsável">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{lead.responsible}</div>
                  <span style={{ fontSize: 13, color: '#e8eaf0' }}>{respName} · Vendedora</span>
                </div>
              </Field>
            </div>
          </Section>

          {/* History */}
          <Section title="Histórico de interações" action="+ Registrar">
            <HistoryList />
          </Section>
        </div>

        {/* Right column */}
        <div style={{ width: 360, flexShrink: 0 }}>
          {/* Right tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #22283a', marginBottom: 16 }}>
            {([['tasks', 'Tarefas'], ['products', 'Produtos'], ['notes', 'Notas']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setRightTab(key)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13, color: rightTab === key ? '#f97316' : '#6b7280', fontWeight: rightTab === key ? 500 : 400, borderBottom: rightTab === key ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {rightTab === 'tasks' && <TasksPanel />}
          {rightTab === 'products' && <EmptyState icon={<Package size={32} color="#6b7280" strokeWidth={1.5} />} text="Nenhum produto vinculado" btnLabel="+ Vincular produto" />}
          {rightTab === 'notes' && <EmptyState icon={<FileText size={32} color="#6b7280" strokeWidth={1.5} />} text="Nenhuma nota ainda" btnLabel="+ Adicionar nota" />}
        </div>
      </div>
    </AppLayout>
  )
}

// ── Section wrapper ──

function Section({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#f97316', cursor: 'pointer' }}>{action}</span>
      </div>
      {children}
    </div>
  )
}

// ── Fields ──

function Field({ label, value, valueColor, children }: { label: string; value?: string; valueColor?: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {value && <div style={{ fontSize: 13, color: valueColor ?? '#e8eaf0', marginTop: 2 }}>{value}</div>}
      {children}
    </div>
  )
}

// ── History ──

function HistoryList() {
  const items = [
    {
      icon: Mail, iconColor: '#3b82f6', title: 'E-mail enviado',
      subCard: { title: 'Proposta Comercial — Plano Pro TriboCRM', badges: [{ text: 'Aberto 3x', bg: 'rgba(34,197,94,0.12)', color: '#22c55e' }, { text: 'Clicou na proposta', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' }] },
      date: 'Hoje · 09:15 · Ana Souza',
    },
    { icon: Phone, iconColor: '#f97316', title: 'Ligação realizada', note: 'Cliente demonstrou interesse alto. Pediu proposta para fechar no plano anual.', date: 'Ontem · 14:30 · Ana Souza' },
    { icon: MessageCircle, iconColor: '#25d166', title: 'WhatsApp', note: 'Primeiro contato — cliente respondeu e demonstrou interesse.', date: '12/01/2026 · 10:00 · Ana Souza' },
    { icon: UserPlus, iconColor: '#6b7280', title: 'Lead criado', note: 'Lead captado via Instagram · atribuído via round-robin', date: '12/01/2026 · 09:00 · Sistema' },
  ]

  return (
    <div>
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < items.length - 1 ? '1px solid #22283a' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.iconColor}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={16} color={item.iconColor} strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{item.title}</div>
              {item.subCard && (
                <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 6, padding: 10, marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: '#e8eaf0', fontWeight: 500 }}>{item.subCard.title}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {item.subCard.badges.map((b) => (
                      <span key={b.text} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: b.bg, color: b.color, fontWeight: 500 }}>{b.text}</span>
                    ))}
                  </div>
                </div>
              )}
              {item.note && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{item.note}</div>}
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{item.date}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tasks Panel ──

function TasksPanel() {
  const tasks = [
    { icon: Phone, iconColor: '#f97316', title: 'Follow-up sobre desconto', due: 'Vence hoje · 14:00', dueColor: '#f59e0b', done: false },
    { icon: Video, iconColor: '#a855f7', title: 'Demo ao vivo para o time', due: '25/03/2026 · 10:00', dueColor: '#9ca3af', done: false, badge: 'Google Calendar' },
    { icon: Mail, iconColor: '#3b82f6', title: 'Enviar material de apresentação', due: 'Concluída · 13/03', dueColor: '#22c55e', done: true },
  ]

  return (
    <div>
      {/* New task form */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 10 }}>Nova atividade</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select style={{ flex: 1, background: '#0f1117', border: '1px solid #22283a', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none' }}>
            <option>Ligação</option><option>E-mail</option><option>Reunião</option><option>WhatsApp</option><option>Proposta</option>
          </select>
          <input type="date" style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none' }} />
        </div>
        <textarea rows={3} placeholder="Descrição da atividade..." style={{ width: '100%', background: '#0f1117', border: '1px solid #22283a', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
        <button style={{ width: '100%', marginTop: 8, background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Adicionar tarefa</button>
      </div>

      {/* Tasks list */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 16 }}>
        {tasks.map((task, i) => {
          const Icon = task.icon
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < tasks.length - 1 ? '1px solid #22283a' : 'none', opacity: task.done ? 0.5 : 1 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: task.done ? 'none' : '1px solid #22283a', background: task.done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {task.done && <Check size={12} color="#fff" strokeWidth={2.5} />}
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `${task.iconColor}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} color={task.iconColor} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1 }}>
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
    </div>
  )
}

// ── Empty state ──

function EmptyState({ icon, text, btnLabel }: { icon: React.ReactNode; text: string; btnLabel: string }) {
  return (
    <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {icon}
      <span style={{ fontSize: 13, color: '#6b7280' }}>{text}</span>
      <button style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{btnLabel}</button>
    </div>
  )
}

// ── Sub-components ──

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span style={{ background: bg, color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{children}</span>
}

function ActBtn({ icon, label, color, border }: { icon: React.ReactNode; label: string; color: string; border: string }) {
  return (
    <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color, cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}0D` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      {icon} {label}
    </button>
  )
}
