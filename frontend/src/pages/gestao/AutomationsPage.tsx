import { useState } from 'react'
import {
  Plus, MoreHorizontal, CheckSquare, MessageCircle, Clock, Mail, Copy, Tag, Bell,
  FileText, Check, X, ArrowLeft, type LucideIcon,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

// ── Types ──

type Tab = 'templates' | 'mine'

interface Template {
  id: string
  triggerIcon: LucideIcon; triggerColor: string; triggerTitle: string; triggerSub: string
  actionIcon: LucideIcon; actionColor: string; actionTitle: string
  badgeLabel: string; badgeColor: string; badgeBg: string
  builderSubtitle: string
  configType: 'whatsapp' | 'email' | 'task' | 'duplicate' | 'notify' | 'meta'
}

interface Automation {
  id: string; icon: LucideIcon; iconColor: string; title: string; active: boolean
  trigger: string; action: string; executions: number; lastExec: string
}

// ── Template Data ──

const templates: { section: string; items: Template[] }[] = [
  {
    section: 'Seguimento de leads',
    items: [
      { id: 't1', triggerIcon: Clock, triggerColor: '#f59e0b', triggerTitle: 'Lead parado há X dias', triggerSub: 'Em Proposta Enviada', actionIcon: MessageCircle, actionColor: '#25d166', actionTitle: 'Enviar WhatsApp para o lead', badgeLabel: 'Envio automático', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure o envio automático de WhatsApp', configType: 'whatsapp' },
      { id: 't2', triggerIcon: FileText, triggerColor: '#3b82f6', triggerTitle: 'Lead muda de etapa', triggerSub: 'Pipeline Principal', actionIcon: Mail, actionColor: '#3b82f6', actionTitle: 'Enviar e-mail para o lead', badgeLabel: 'Envio automático via Gmail', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure o envio automático de e-mail', configType: 'email' },
      { id: 't3', triggerIcon: FileText, triggerColor: '#f97316', triggerTitle: 'Lead muda de etapa', triggerSub: 'Qualquer etapa configurável', actionIcon: CheckSquare, actionColor: '#f97316', actionTitle: 'Criar tarefa para o vendedor', badgeLabel: 'Aparece nas tarefas', badgeColor: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)', builderSubtitle: 'Configure a criação automática de tarefa', configType: 'task' },
    ],
  },
  {
    section: 'Pós-venda e equipe',
    items: [
      { id: 't4', triggerIcon: Check, triggerColor: '#22c55e', triggerTitle: 'Venda Realizada', triggerSub: 'Em qualquer funil', actionIcon: Copy, actionColor: '#a855f7', actionTitle: 'Duplicar para funil Pós-Venda', badgeLabel: 'Automático com histórico', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure a duplicação automática de lead', configType: 'duplicate' },
      { id: 't5', triggerIcon: Clock, triggerColor: '#f97316', triggerTitle: 'Vendedor atinge 80% da meta', triggerSub: 'Qualquer período', actionIcon: MessageCircle, actionColor: '#25d166', actionTitle: 'Enviar WhatsApp motivacional', badgeLabel: 'Envio automático', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure a mensagem motivacional', configType: 'meta' },
      { id: 't6', triggerIcon: X, triggerColor: '#ef4444', triggerTitle: 'Lead movido para Perdido', triggerSub: 'Qualquer pipeline', actionIcon: Bell, actionColor: '#f97316', actionTitle: 'Notificar gestor no painel', badgeLabel: 'Notificação interna', badgeColor: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)', builderSubtitle: 'Configure a notificação ao gestor', configType: 'notify' },
    ],
  },
]

// ── My Automations Data ──

const myAutomations: Automation[] = [
  { id: 'a1', icon: CheckSquare, iconColor: '#f97316', title: 'Tarefa ao entrar em contato', active: true, trigger: 'Lead muda para "Em Contato"', action: 'Criar tarefa "Ligar para o lead" em 24h', executions: 47, lastExec: 'hoje 14:32' },
  { id: 'a2', icon: MessageCircle, iconColor: '#25d166', title: 'WhatsApp de boas-vindas', active: true, trigger: 'Lead entra no pipeline (qualquer etapa)', action: 'Enviar modelo "Primeiro contato WhatsApp"', executions: 89, lastExec: 'hoje 09:15' },
  { id: 'a3', icon: Clock, iconColor: '#f59e0b', title: 'Alerta de inatividade — Quente', active: true, trigger: 'Lead Quente sem atividade há 2 dias', action: 'Notificar vendedor responsável', executions: 23, lastExec: 'ontem 08:00' },
  { id: 'a4', icon: Mail, iconColor: '#3b82f6', title: 'E-mail de follow-up — Proposta', active: true, trigger: 'Lead em "Proposta Enviada" sem atividade há 3 dias', action: 'Enviar modelo "Follow-up proposta 3 dias"', executions: 12, lastExec: 'há 2 dias' },
  { id: 'a5', icon: Copy, iconColor: '#a855f7', title: 'Duplicar para pós-venda', active: true, trigger: 'Lead chega em "Venda Realizada"', action: 'Duplicar card para funil "Pós-Venda"', executions: 8, lastExec: 'há 3 dias' },
  { id: 'a6', icon: Clock, iconColor: '#6b7280', title: 'Alerta de inatividade — Morno', active: false, trigger: 'Lead Morno sem atividade há 5 dias', action: 'Notificar vendedor + criar tarefa de follow-up', executions: 31, lastExec: 'há 5 dias' },
  { id: 'a7', icon: MessageCircle, iconColor: '#6b7280', title: 'WhatsApp aniversário', active: false, trigger: 'Data de nascimento do vendedor', action: 'Enviar mensagem de parabéns configurada', executions: 3, lastExec: '15/03/2026' },
  { id: 'a8', icon: Tag, iconColor: '#6b7280', title: 'Tag automática — Lead Frio', active: false, trigger: 'Lead sem atividade há 10 dias', action: 'Alterar temperatura para Frio', executions: 19, lastExec: 'há 4 dias' },
]

const menuOpts = ['Editar', 'Duplicar', 'Ver execuções', 'Excluir']
const inputS: React.CSSProperties = { width: '100%', background: '#111318', border: '1px solid #22283a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }

// ── Component ──

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>('templates')
  const [items, setItems] = useState(myAutomations)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [builder, setBuilder] = useState<Template | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  function toggleActive(id: string) { setItems(p => p.map(a => a.id === id ? { ...a, active: !a.active } : a)) }

  // Builder mode
  if (builder) return (
    <AppLayout menuItems={gestaoMenuItems}>
      <BuilderView template={builder} onBack={() => setBuilder(null)} />
    </AppLayout>
  )

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Automações</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Regras automáticas para o seu pipeline</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #22283a', marginBottom: 20 }}>
        {([['templates', 'Modelos prontos'], ['mine', `Minhas automações (${items.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 20px', fontSize: 13,
            color: tab === k ? '#f97316' : '#6b7280', fontWeight: tab === k ? 500 : 400,
            borderBottom: tab === k ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>

      {/* Templates tab */}
      {tab === 'templates' && templates.map(section => (
        <div key={section.section} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: 12 }}>{section.section}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {section.items.map(t => {
              const TIcon = t.triggerIcon; const AIcon = t.actionIcon
              const isHov = hoveredCard === t.id
              return (
                <div key={t.id}
                  onMouseEnter={() => setHoveredCard(t.id)} onMouseLeave={() => setHoveredCard(null)}
                  style={{ background: '#161a22', border: `1px solid ${isHov ? 'rgba(249,115,22,0.5)' : '#22283a'}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}>
                  {/* Trigger */}
                  <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TIcon size={16} color={t.triggerColor} strokeWidth={1.5} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#e8eaf0' }}>{t.triggerTitle}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{t.triggerSub}</div>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>↓</div>
                  {/* Action */}
                  <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AIcon size={16} color={t.actionColor} strokeWidth={1.5} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#e8eaf0' }}>{t.actionTitle}</div>
                      <span style={{ background: t.badgeBg, color: t.badgeColor, borderRadius: 4, padding: '2px 6px', fontSize: 10 }}>{t.badgeLabel}</span>
                    </div>
                  </div>
                  {/* Use button — shows on hover */}
                  <button onClick={() => setBuilder(t)} style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: '#f97316', color: '#fff', border: 'none', padding: 10,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    opacity: isHov ? 1 : 0, transition: 'opacity 0.2s',
                    borderRadius: '0 0 12px 12px',
                  }}>Usar este modelo</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* My automations tab */}
      {tab === 'mine' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
            <span style={{ color: '#6b7280' }}>Ativas</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{items.filter(a => a.active).length}</span>
            <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
            <span style={{ color: '#6b7280' }}>Pausadas</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{items.filter(a => !a.active).length}</span>
            <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
            <span style={{ color: '#6b7280' }}>Execuções este mês</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>127</span>
          </div>
          {items.map(a => {
            const Icon = a.icon
            return (
              <div key={a.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginBottom: 12, opacity: a.active ? 1 : 0.7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${a.iconColor}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={a.iconColor} strokeWidth={1.5} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', flex: 1 }}>{a.title}</span>
                  <span style={{ background: a.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: a.active ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{a.active ? 'Ativa' : 'Pausada'}</span>
                  <div onClick={() => toggleActive(a.id)} style={{ width: 36, height: 20, borderRadius: 999, cursor: 'pointer', background: a.active ? '#f97316' : '#22283a', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: a.active ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: a.active ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: openMenu === a.id ? '#22283a' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </button>
                    {openMenu === a.id && (
                      <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                        {menuOpts.map(opt => (
                          <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4, paddingLeft: 44 }}><span style={{ color: '#6b7280' }}>Quando: </span>{a.trigger}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8, paddingLeft: 44 }}><span style={{ color: '#6b7280' }}>Ação: </span>{a.action}</div>
                <div style={{ fontSize: 12, color: '#6b7280', paddingLeft: 44 }}>Executada {a.executions}x · Última execução: {a.lastExec}</div>
              </div>
            )
          })}
        </>
      )}
    </AppLayout>
  )
}

// ── Builder View ──

function BuilderView({ template: t, onBack }: { template: Template; onBack: () => void }) {
  const [name, setName] = useState('')
  const [stage, setStage] = useState('Proposta Enviada')
  const [days, setDays] = useState('3')
  const [unit, setUnit] = useState('dias')
  const [model, setModel] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskType, setTaskType] = useState('Ligação')
  const [funnel, setFunnel] = useState('Pós-Venda')
  const [notifyUser, setNotifyUser] = useState('Gestor (Lucas Silveira)')

  const TIcon = t.triggerIcon; const AIcon = t.actionIcon
  const stageOpts = ['Sem Contato', 'Em Contato', 'Negociando', 'Proposta Enviada', 'Venda Realizada']

  const triggerSummary = t.configType === 'whatsapp' ? `Lead parado há ${days} ${unit} em ${stage}` : t.configType === 'email' ? `Lead muda para ${stage}` : t.configType === 'task' ? `Lead muda para ${stage}` : t.configType === 'duplicate' ? 'Lead chega em Venda Realizada' : t.configType === 'notify' ? 'Lead movido para Perdido' : 'Vendedor atinge 80% da meta'
  const actionSummary = t.actionTitle

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
          <ArrowLeft size={14} strokeWidth={1.5} /> Voltar aos modelos
        </button>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Modelos → Configurar automação</span>
      </div>

      {/* Builder card */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 16, padding: 24, maxWidth: 540, margin: '0 auto' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Configurar automação</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 20 }}>{t.builderSubtitle}</p>

        {/* Trigger block */}
        <div style={{ background: '#111318', border: '1px solid #22283a', borderRadius: 10, padding: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Quando isso acontecer — Gatilho</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TIcon size={16} color={t.triggerColor} strokeWidth={1.5} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{t.triggerTitle}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{t.triggerSub}</div>
            </div>
          </div>
          {(t.configType === 'whatsapp' || t.configType === 'email' || t.configType === 'task') && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...inputS, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
                {stageOpts.map(s => <option key={s}>{s}</option>)}
              </select>
              {t.configType === 'whatsapp' && (
                <>
                  <input type="number" value={days} onChange={e => setDays(e.target.value)} style={{ ...inputS, width: 60 }} />
                  <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputS, width: 80, appearance: 'none' as const, cursor: 'pointer' }}>
                    <option>dias</option><option>horas</option>
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        {/* Arrow */}
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 16, padding: '4px 0' }}>↓</div>

        {/* Action block */}
        <div style={{ background: '#111318', border: '1px solid #22283a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Então fazer isso — Ação</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AIcon size={16} color={t.actionColor} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{t.actionTitle}</span>
          </div>

          {(t.configType === 'whatsapp' || t.configType === 'meta') && (
            <>
              <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer', marginBottom: 10 }}>
                <option value="">Selecionar modelo de WhatsApp...</option>
                <option>Primeiro contato WhatsApp</option><option>Follow-up 3 dias</option><option>Mensagem motivacional</option>
              </select>
              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                A mensagem será enviada automaticamente pela extensão do Chrome. Para isso, mantenha o WhatsApp Web aberto. Se falhar, você receberá uma notificação com botão de reenvio.
              </div>
            </>
          )}
          {t.configType === 'email' && (
            <>
              <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer', marginBottom: 10 }}>
                <option value="">Selecionar modelo de e-mail...</option>
                <option>Follow-up proposta</option><option>Boas-vindas</option><option>Apresentação comercial</option>
              </select>
              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                O e-mail será enviado via integração Gmail OAuth2. Certifique-se de que a conta está conectada em Configurações.
              </div>
            </>
          )}
          {t.configType === 'task' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Título da tarefa" style={inputS} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={taskType} onChange={e => setTaskType(e.target.value)} style={{ ...inputS, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
                  <option>Ligação</option><option>E-mail</option><option>Reunião</option><option>WhatsApp</option>
                </select>
                <input type="number" value={days} onChange={e => setDays(e.target.value)} style={{ ...inputS, width: 60 }} />
                <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputS, width: 80, appearance: 'none' as const, cursor: 'pointer' }}>
                  <option>horas</option><option>dias</option>
                </select>
              </div>
            </div>
          )}
          {t.configType === 'duplicate' && (
            <select value={funnel} onChange={e => setFunnel(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option>Pós-Venda</option><option>Sucesso do Cliente</option>
            </select>
          )}
          {t.configType === 'notify' && (
            <select value={notifyUser} onChange={e => setNotifyUser(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option>Gestor (Lucas Silveira)</option><option>Líder do time</option>
            </select>
          )}
        </div>

        {/* Summary */}
        <div style={{ background: '#0f1117', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Resumo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
            <span style={{ color: '#e8eaf0' }}>Quando {triggerSummary}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ color: '#e8eaf0' }}>Então {actionSummary}</span>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Nome desta automação <span style={{ color: '#f97316' }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Follow-up automático 3 dias" style={inputS} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Cancelar</button>
          <button disabled={!name.trim()} style={{
            background: name.trim() ? '#f97316' : '#22283a', border: 'none', borderRadius: 8,
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            color: name.trim() ? '#fff' : '#6b7280', cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}>Salvar e ativar</button>
        </div>
      </div>
    </div>
  )
}
