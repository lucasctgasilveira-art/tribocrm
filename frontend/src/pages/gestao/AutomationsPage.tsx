import { useState, useEffect, useCallback } from 'react'
import {
  Plus, MoreHorizontal, CheckSquare, MessageCircle, Clock, Mail, Copy, Bell,
  FileText, Check, X, ArrowLeft, Loader2, type LucideIcon,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getAutomations, createAutomation, updateAutomation, deleteAutomation } from '../../services/automations.service'
import { getPipelines } from '../../services/pipeline.service'

// ── Types ──

type Tab = 'templates' | 'mine'

interface Template {
  id: string
  triggerIcon: LucideIcon; triggerColor: string; triggerTitle: string; triggerSub: string
  actionIcon: LucideIcon; actionColor: string; actionTitle: string
  badgeLabel: string; badgeColor: string; badgeBg: string
  builderSubtitle: string
  triggerType: string; actionType: string
  configType: 'whatsapp' | 'email' | 'task' | 'duplicate' | 'notify' | 'meta'
}

interface ApiAutomation {
  id: string
  name: string
  triggerType: string
  triggerConfig: Record<string, unknown>
  actionType: string
  actionConfig: Record<string, unknown>
  isActive: boolean
  pipelineId: string | null
  pipeline: { id: string; name: string } | null
  createdAt: string
}

interface Meta {
  activeCount: number
  pausedCount: number
  executionsThisMonth: number
}

interface PipelineOption {
  id: string
  name: string
  stages: { id: string; name: string }[]
}

// ── Config ──

const triggerIcons: Record<string, { icon: LucideIcon; color: string }> = {
  STAGE_CHANGED: { icon: FileText, color: '#3b82f6' },
  INACTIVE_DAYS: { icon: Clock, color: '#f59e0b' },
  TASK_OVERDUE: { icon: Clock, color: '#ef4444' },
  LEAD_CREATED: { icon: Plus, color: '#22c55e' },
  GOAL_REACHED: { icon: Check, color: '#22c55e' },
  FORM_SUBMITTED: { icon: FileText, color: '#a855f7' },
}

const triggerLabels: Record<string, string> = {
  STAGE_CHANGED: 'Lead muda de etapa', INACTIVE_DAYS: 'Lead parado há X dias',
  TASK_OVERDUE: 'Tarefa atrasada', LEAD_CREATED: 'Lead criado',
  GOAL_REACHED: 'Meta atingida', FORM_SUBMITTED: 'Formulário enviado',
}

const actionLabels: Record<string, string> = {
  SEND_WHATSAPP: 'Enviar WhatsApp', SEND_EMAIL: 'Enviar e-mail',
  CREATE_TASK: 'Criar tarefa', MOVE_STAGE: 'Mover etapa',
  NOTIFY_USER: 'Notificar usuário', DUPLICATE_LEAD: 'Duplicar lead',
  MOVE_TO_PIPELINE: 'Mover para pipeline',
}

const defaultIcon = { icon: Clock, color: '#6b7280' }

const templates: { section: string; items: Template[] }[] = [
  {
    section: 'Seguimento de leads',
    items: [
      { id: 't1', triggerIcon: Clock, triggerColor: '#f59e0b', triggerTitle: 'Lead parado há X dias', triggerSub: 'Em Proposta Enviada', actionIcon: MessageCircle, actionColor: '#25d166', actionTitle: 'Enviar WhatsApp para o lead', badgeLabel: 'Envio automático', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure o envio automático de WhatsApp', triggerType: 'INACTIVE_DAYS', actionType: 'SEND_WHATSAPP', configType: 'whatsapp' },
      { id: 't2', triggerIcon: FileText, triggerColor: '#3b82f6', triggerTitle: 'Lead muda de etapa', triggerSub: 'Pipeline Principal', actionIcon: Mail, actionColor: '#3b82f6', actionTitle: 'Enviar e-mail para o lead', badgeLabel: 'Envio automático via Gmail', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure o envio automático de e-mail', triggerType: 'STAGE_CHANGED', actionType: 'SEND_EMAIL', configType: 'email' },
      { id: 't3', triggerIcon: FileText, triggerColor: '#f97316', triggerTitle: 'Lead muda de etapa', triggerSub: 'Qualquer etapa configurável', actionIcon: CheckSquare, actionColor: '#f97316', actionTitle: 'Criar tarefa para o vendedor', badgeLabel: 'Aparece nas tarefas', badgeColor: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)', builderSubtitle: 'Configure a criação automática de tarefa', triggerType: 'STAGE_CHANGED', actionType: 'CREATE_TASK', configType: 'task' },
    ],
  },
  {
    section: 'Pós-venda e equipe',
    items: [
      { id: 't4', triggerIcon: Check, triggerColor: '#22c55e', triggerTitle: 'Venda Realizada', triggerSub: 'Em qualquer funil', actionIcon: Copy, actionColor: '#a855f7', actionTitle: 'Duplicar para funil Pós-Venda', badgeLabel: 'Automático com histórico', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure a duplicação automática de lead', triggerType: 'STAGE_CHANGED', actionType: 'DUPLICATE_LEAD', configType: 'duplicate' },
      { id: 't5', triggerIcon: Clock, triggerColor: '#f97316', triggerTitle: 'Vendedor atinge 80% da meta', triggerSub: 'Qualquer período', actionIcon: MessageCircle, actionColor: '#25d166', actionTitle: 'Enviar WhatsApp motivacional', badgeLabel: 'Envio automático', badgeColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', builderSubtitle: 'Configure a mensagem motivacional', triggerType: 'GOAL_REACHED', actionType: 'SEND_WHATSAPP', configType: 'meta' },
      { id: 't6', triggerIcon: X, triggerColor: '#ef4444', triggerTitle: 'Lead movido para Perdido', triggerSub: 'Qualquer pipeline', actionIcon: Bell, actionColor: '#f97316', actionTitle: 'Notificar gestor no painel', badgeLabel: 'Notificação interna', badgeColor: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)', builderSubtitle: 'Configure a notificação ao gestor', triggerType: 'STAGE_CHANGED', actionType: 'NOTIFY_USER', configType: 'notify' },
    ],
  },
]

const menuOpts = ['Editar', 'Excluir']
const inputS: React.CSSProperties = { width: '100%', background: '#111318', border: '1px solid #22283a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }

// ── Component ──

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>('templates')
  const [automations, setAutomations] = useState<ApiAutomation[]>([])
  const [meta, setMeta] = useState<Meta>({ activeCount: 0, pausedCount: 0, executionsThisMonth: 0 })
  const [pipelines, setPipelines] = useState<PipelineOption[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [builder, setBuilder] = useState<Template | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [result, pipelinesData] = await Promise.all([
        getAutomations(),
        getPipelines(),
      ])
      setAutomations(result.data)
      setMeta(result.meta)
      setPipelines(pipelinesData)
    } catch {
      setAutomations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleToggleActive(a: ApiAutomation) {
    try {
      await updateAutomation(a.id, { isActive: !a.isActive })
      loadData()
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAutomation(id)
      setOpenMenu(null)
      loadData()
    } catch { /* ignore */ }
  }

  async function handleBuilderSave(payload: { name: string; pipelineId?: string; triggerType: string; triggerConfig: Record<string, unknown>; actionType: string; actionConfig: Record<string, unknown> }) {
    try {
      await createAutomation(payload)
      setBuilder(null)
      setTab('mine')
      loadData()
    } catch { /* ignore */ }
  }

  // Builder mode
  if (builder) return (
    <AppLayout menuItems={gestaoMenuItems}>
      <BuilderView template={builder} pipelines={pipelines} onBack={() => setBuilder(null)} onSave={handleBuilderSave} />
    </AppLayout>
  )

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Automações</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Regras automáticas para o seu pipeline</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #22283a', marginBottom: 20 }}>
        {([['templates', 'Modelos prontos'], ['mine', `Minhas automações (${automations.length})`]] as const).map(([k, l]) => (
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
                <div key={t.id} onMouseEnter={() => setHoveredCard(t.id)} onMouseLeave={() => setHoveredCard(null)}
                  style={{ background: '#161a22', border: `1px solid ${isHov ? 'rgba(249,115,22,0.5)' : '#22283a'}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TIcon size={16} color={t.triggerColor} strokeWidth={1.5} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#e8eaf0' }}>{t.triggerTitle}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{t.triggerSub}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>↓</div>
                  <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AIcon size={16} color={t.actionColor} strokeWidth={1.5} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#e8eaf0' }}>{t.actionTitle}</div>
                      <span style={{ background: t.badgeBg, color: t.badgeColor, borderRadius: 4, padding: '2px 6px', fontSize: 10 }}>{t.badgeLabel}</span>
                    </div>
                  </div>
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
        loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
            <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
            <span style={{ fontSize: 14, color: '#6b7280' }}>Carregando automações...</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
              <span style={{ color: '#6b7280' }}>Ativas</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{meta.activeCount}</span>
              <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
              <span style={{ color: '#6b7280' }}>Pausadas</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{meta.pausedCount}</span>
              <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
              <span style={{ color: '#6b7280' }}>Execuções este mês</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{meta.executionsThisMonth}</span>
            </div>
            {automations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 14 }}>Nenhuma automação criada</div>
            ) : automations.map(a => {
              const ti = triggerIcons[a.triggerType] ?? defaultIcon
              const Icon = ti.icon
              return (
                <div key={a.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginBottom: 12, opacity: a.isActive ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${ti.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={ti.color} strokeWidth={1.5} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', flex: 1 }}>{a.name}</span>
                    <span style={{ background: a.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: a.isActive ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{a.isActive ? 'Ativa' : 'Pausada'}</span>
                    <div onClick={() => handleToggleActive(a)} style={{ width: 36, height: 20, borderRadius: 999, cursor: 'pointer', background: a.isActive ? '#f97316' : '#22283a', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: a.isActive ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: a.isActive ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: openMenu === a.id ? '#22283a' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                        <MoreHorizontal size={14} strokeWidth={1.5} />
                      </button>
                      {openMenu === a.id && (
                        <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                          {menuOpts.map(opt => (
                            <div key={opt} onClick={() => { if (opt === 'Excluir') handleDelete(a.id); else setOpenMenu(null) }}
                              style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4, paddingLeft: 44 }}>
                    <span style={{ color: '#6b7280' }}>Quando: </span>{triggerLabels[a.triggerType] ?? a.triggerType}
                    {a.pipeline && <span style={{ color: '#6b7280' }}> · {a.pipeline.name}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#9ca3af', paddingLeft: 44 }}>
                    <span style={{ color: '#6b7280' }}>Ação: </span>{actionLabels[a.actionType] ?? a.actionType}
                  </div>
                </div>
              )
            })}
          </>
        )
      )}
    </AppLayout>
  )
}

// ── Builder View ──

function BuilderView({ template: t, pipelines, onBack, onSave }: {
  template: Template; pipelines: PipelineOption[]
  onBack: () => void
  onSave: (p: { name: string; pipelineId?: string; triggerType: string; triggerConfig: Record<string, unknown>; actionType: string; actionConfig: Record<string, unknown> }) => void
}) {
  const [name, setName] = useState('')
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '')
  const [stageId, setStageId] = useState('')
  const [days, setDays] = useState('3')

  const selectedPipeline = pipelines.find(p => p.id === pipelineId)
  const stages = selectedPipeline?.stages ?? []

  const TIcon = t.triggerIcon; const AIcon = t.actionIcon

  function handleSave() {
    const triggerConfig: Record<string, unknown> = {}
    if (stageId) triggerConfig.stageId = stageId
    if (t.configType === 'whatsapp') triggerConfig.days = parseInt(days)

    const actionConfig: Record<string, unknown> = { type: t.configType }

    onSave({ name, pipelineId, triggerType: t.triggerType, triggerConfig, actionType: t.actionType, actionConfig })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
          <ArrowLeft size={14} strokeWidth={1.5} /> Voltar aos modelos
        </button>
      </div>

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
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId('') }} style={{ ...inputS, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {(t.configType === 'whatsapp' || t.configType === 'email' || t.configType === 'task') && stages.length > 0 && (
              <select value={stageId} onChange={e => setStageId(e.target.value)} style={{ ...inputS, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
                <option value="">Qualquer etapa</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {t.configType === 'whatsapp' && (
              <input type="number" value={days} onChange={e => setDays(e.target.value)} placeholder="Dias" style={{ ...inputS, width: 70 }} />
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 16, padding: '4px 0' }}>↓</div>

        {/* Action block */}
        <div style={{ background: '#111318', border: '1px solid #22283a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Então fazer isso — Ação</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AIcon size={16} color={t.actionColor} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{t.actionTitle}</span>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Nome desta automação <span style={{ color: '#f97316' }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Follow-up automático 3 dias" style={inputS} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            background: name.trim() ? '#f97316' : '#22283a', border: 'none', borderRadius: 8,
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            color: name.trim() ? '#fff' : '#6b7280', cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}>Salvar e ativar</button>
        </div>
      </div>
    </div>
  )
}
