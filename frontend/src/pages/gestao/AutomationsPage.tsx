import { useState, useEffect, useCallback } from 'react'
import {
  Plus, MoreHorizontal, CheckSquare, MessageCircle, Clock, Mail, Copy, Bell,
  FileText, Check, X, ArrowLeft, Loader2, Users, Tag, ShieldCheck, Repeat, ArrowRight,
  type LucideIcon,
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
  configType: 'whatsapp' | 'email' | 'task' | 'duplicate' | 'notify' | 'meta' | 'move' | 'roundrobin' | 'tag' | 'system'
  // System templates are read-only documentation cards — they describe
  // automations that already run automatically at the platform level
  // (Instância 1 / Super Admin) and cannot be created or toggled by tenants.
  system?: boolean
}

interface ApiAutomation {
  id: string; name: string; triggerType: string
  triggerConfig: Record<string, unknown>; actionType: string
  actionConfig: Record<string, unknown>; isActive: boolean
  pipelineId: string | null; pipeline: { id: string; name: string } | null
  createdAt: string
}

interface Meta { activeCount: number; pausedCount: number; executionsThisMonth: number }
interface PipelineOption { id: string; name: string; stages: { id: string; name: string }[] }

// ── Config ──

const triggerIcons: Record<string, { icon: LucideIcon; color: string }> = {
  STAGE_CHANGED: { icon: FileText, color: '#3b82f6' },
  INACTIVE_DAYS: { icon: Clock, color: '#f59e0b' },
  TASK_OVERDUE: { icon: Clock, color: '#ef4444' },
  LEAD_CREATED: { icon: Plus, color: '#22c55e' },
  GOAL_REACHED: { icon: Check, color: '#22c55e' },
  FORM_SUBMITTED: { icon: FileText, color: '#a855f7' },
  EMAIL_OPENED: { icon: Mail, color: '#3b82f6' },
  PRODUCT_ADDED: { icon: Tag, color: '#f97316' },
  DISCOUNT_REQUESTED: { icon: ShieldCheck, color: '#a855f7' },
  REPEAT_PURCHASE: { icon: Repeat, color: '#22c55e' },
}

const triggerLabels: Record<string, string> = {
  STAGE_CHANGED: 'Lead muda de etapa', INACTIVE_DAYS: 'Lead parado há X dias',
  TASK_OVERDUE: 'Tarefa atrasada', LEAD_CREATED: 'Lead criado',
  GOAL_REACHED: 'Meta atingida', FORM_SUBMITTED: 'Formulário enviado',
  EMAIL_OPENED: 'Lead abriu e-mail', PRODUCT_ADDED: 'Produto adicionado',
  DISCOUNT_REQUESTED: 'Desconto solicitado', REPEAT_PURCHASE: 'Compra recorrente',
}

const actionLabels: Record<string, string> = {
  SEND_WHATSAPP: 'Enviar WhatsApp', SEND_EMAIL: 'Enviar e-mail',
  CREATE_TASK: 'Criar tarefa', MOVE_STAGE: 'Mover etapa',
  NOTIFY_USER: 'Notificar usuário', DUPLICATE_LEAD: 'Duplicar lead',
  MOVE_TO_PIPELINE: 'Mover para pipeline', ROUND_ROBIN: 'Distribuir round-robin',
  ADD_TAG: 'Adicionar tag', REQUIRE_LOSS_REASON: 'Solicitar motivo de perda',
  REGISTER_HISTORY: 'Registrar no histórico',
}

const defaultIcon = { icon: Clock, color: 'var(--text-muted)' }

function t(id: string, tIcon: LucideIcon, tColor: string, tTitle: string, tSub: string, aIcon: LucideIcon, aColor: string, aTitle: string, badge: string, bColor: string, bBg: string, sub: string, tType: string, aType: string, cType: Template['configType']): Template {
  return { id, triggerIcon: tIcon, triggerColor: tColor, triggerTitle: tTitle, triggerSub: tSub, actionIcon: aIcon, actionColor: aColor, actionTitle: aTitle, badgeLabel: badge, badgeColor: bColor, badgeBg: bBg, builderSubtitle: sub, triggerType: tType, actionType: aType, configType: cType }
}

function tSys(id: string, tIcon: LucideIcon, tColor: string, tTitle: string, tSub: string, aIcon: LucideIcon, aColor: string, aTitle: string, sub: string, tType: string, aType: string): Template {
  return {
    id, triggerIcon: tIcon, triggerColor: tColor, triggerTitle: tTitle, triggerSub: tSub,
    actionIcon: aIcon, actionColor: aColor, actionTitle: aTitle,
    badgeLabel: 'Sistema', badgeColor: '#a855f7', badgeBg: 'rgba(168,85,247,0.12)',
    builderSubtitle: sub, triggerType: tType, actionType: aType,
    configType: 'system', system: true,
  }
}

const templates: { section: string; items: Template[] }[] = [
  {
    section: 'Seguimento de leads',
    items: [
      t('t1', Clock, '#f59e0b', 'Lead parado há X dias', 'Na etapa configurável', CheckSquare, '#f97316', 'Criar tarefa de follow-up', 'Tarefa automática', '#f59e0b', 'rgba(245,158,11,0.12)', 'Crie tarefas de follow-up automaticamente', 'INACTIVE_DAYS', 'CREATE_TASK', 'task'),
      t('t2', FileText, '#3b82f6', 'Lead movido para etapa X', 'Pipeline configurável', CheckSquare, '#f97316', 'Agendar tarefa de follow-up em X dias', 'Tarefa agendada', '#f59e0b', 'rgba(245,158,11,0.12)', 'Agende follow-up ao mover lead', 'STAGE_CHANGED', 'CREATE_TASK', 'task'),
      t('t3', Check, '#22c55e', 'Lead movido para "Venda Realizada"', 'Qualquer pipeline', MessageCircle, '#25d166', 'Enviar WhatsApp de parabéns ao vendedor', 'Envio automático', '#22c55e', 'rgba(34,197,94,0.12)', 'Parabenize o vendedor automaticamente', 'STAGE_CHANGED', 'SEND_WHATSAPP', 'whatsapp'),
      t('t4', X, '#ef4444', 'Lead movido para "Perdido"', 'Qualquer pipeline', ShieldCheck, '#a855f7', 'Solicitar motivo de perda obrigatório', 'Obrigatório', '#ef4444', 'rgba(239,68,68,0.12)', 'Exija motivo de perda ao mover lead', 'STAGE_CHANGED', 'REQUIRE_LOSS_REASON', 'notify'),
      t('t5', Clock, '#f59e0b', 'Lead X dias em etapa X', 'Pipeline configurável', Bell, '#f97316', 'Notificar gestor', 'Notificação interna', '#f59e0b', 'rgba(245,158,11,0.12)', 'Alerte o gestor sobre leads parados', 'INACTIVE_DAYS', 'NOTIFY_USER', 'notify'),
      t('t6', FileText, '#3b82f6', 'Lead chegar à etapa X', 'Pipeline configurável', MessageCircle, '#25d166', 'Enviar WhatsApp para o lead', 'Envio automático', '#22c55e', 'rgba(34,197,94,0.12)', 'Envie WhatsApp ao lead ao mudar de etapa', 'STAGE_CHANGED', 'SEND_WHATSAPP', 'whatsapp'),
      t('t7', Clock, '#f59e0b', 'Lead X dias sem movimentação', 'Qualquer etapa', MessageCircle, '#25d166', 'Enviar WhatsApp para o lead', 'Envio automático', '#22c55e', 'rgba(34,197,94,0.12)', 'Re-engaje leads parados via WhatsApp', 'INACTIVE_DAYS', 'SEND_WHATSAPP', 'whatsapp'),
      t('t8', Clock, '#f59e0b', 'Lead X dias sem movimentação', 'Qualquer etapa', Mail, '#3b82f6', 'Enviar e-mail para o lead', 'Envio via Gmail', '#22c55e', 'rgba(34,197,94,0.12)', 'Re-engaje leads parados via e-mail', 'INACTIVE_DAYS', 'SEND_EMAIL', 'email'),
      t('t9', FileText, '#3b82f6', 'Lead chegar à etapa X', 'Pipeline de origem', Copy, '#a855f7', 'Duplicar card para outro funil', 'Automático com histórico', '#22c55e', 'rgba(34,197,94,0.12)', 'Duplique o lead em outro pipeline', 'STAGE_CHANGED', 'DUPLICATE_LEAD', 'duplicate'),
      t('t10', FileText, '#3b82f6', 'Lead chegar à etapa X', 'Pipeline de origem', ArrowRight, '#a855f7', 'Mover card para outro funil', 'Mover automático', '#3b82f6', 'rgba(59,130,246,0.12)', 'Mova o lead para outro pipeline', 'STAGE_CHANGED', 'MOVE_TO_PIPELINE', 'move'),
    ],
  },
  {
    section: 'Comunicação',
    items: [
      t('t11', Plus, '#22c55e', 'Novo lead no pipeline', 'Qualquer pipeline', MessageCircle, '#25d166', 'Enviar boas-vindas WhatsApp', 'Envio automático', '#22c55e', 'rgba(34,197,94,0.12)', 'Envie boas-vindas ao novo lead', 'LEAD_CREATED', 'SEND_WHATSAPP', 'whatsapp'),
      t('t12', Clock, '#f59e0b', 'Proposta sem resposta X dias', 'Em Proposta Enviada', Mail, '#3b82f6', 'Disparar e-mail de acompanhamento', 'Envio via Gmail', '#22c55e', 'rgba(34,197,94,0.12)', 'Acompanhe propostas sem resposta', 'INACTIVE_DAYS', 'SEND_EMAIL', 'email'),
      t('t13', Clock, '#ef4444', 'Tarefa vencer sem concluir', 'Qualquer tipo', Bell, '#f97316', 'Notificar vendedor e líder', 'Notificação interna', '#f59e0b', 'rgba(245,158,11,0.12)', 'Alerte sobre tarefas atrasadas', 'TASK_OVERDUE', 'NOTIFY_USER', 'notify'),
      t('t14', Mail, '#3b82f6', 'Lead abrir e-mail', 'Qualquer modelo', Bell, '#f97316', 'Notificar vendedor em tempo real', 'Notificação push', '#3b82f6', 'rgba(59,130,246,0.12)', 'Avise o vendedor quando o lead abrir o e-mail', 'EMAIL_OPENED', 'NOTIFY_USER', 'notify'),
      t('t15', X, '#ef4444', 'Negócio perdido', 'Qualquer pipeline', Mail, '#3b82f6', 'Enviar e-mail para o lead', 'Envio via Gmail', '#22c55e', 'rgba(34,197,94,0.12)', 'Envie um e-mail de encerramento', 'STAGE_CHANGED', 'SEND_EMAIL', 'email'),
    ],
  },
  {
    section: 'Leads',
    items: [
      t('t16', Plus, '#22c55e', 'Novo lead criado', 'Qualquer pipeline', Users, '#3b82f6', 'Distribuir via round-robin', 'Distribuição automática', '#3b82f6', 'rgba(59,130,246,0.12)', 'Distribua leads automaticamente entre vendedores', 'LEAD_CREATED', 'ROUND_ROBIN', 'roundrobin'),
      t('t17', Plus, '#22c55e', 'Card adicionado ao pipeline', 'Pipeline configurável', CheckSquare, '#f97316', 'Criar tarefa automática', 'Tarefa automática', '#f59e0b', 'rgba(245,158,11,0.12)', 'Crie tarefa automaticamente para novos leads', 'LEAD_CREATED', 'CREATE_TASK', 'task'),
      t('t18', Tag, '#f97316', 'Produto adicionado ao lead', 'Qualquer produto', CheckSquare, '#f97316', 'Criar tarefa relacionada ao produto', 'Tarefa automática', '#f59e0b', 'rgba(245,158,11,0.12)', 'Crie tarefa ao vincular produto', 'PRODUCT_ADDED', 'CREATE_TASK', 'task'),
    ],
  },
  {
    section: 'Equipe',
    items: [
      t('t19', Check, '#22c55e', 'Vendedor atingir 100% da meta', 'Qualquer período', Bell, '#22c55e', 'Notificar equipe com parabéns', 'Notificação interna', '#22c55e', 'rgba(34,197,94,0.12)', 'Parabenize quando a meta for batida', 'GOAL_REACHED', 'NOTIFY_USER', 'meta'),
      t('t20', Check, '#f97316', 'Vendedor atingir 80% da meta', 'Qualquer período', MessageCircle, '#25d166', 'Enviar WhatsApp motivacional', 'Envio automático', '#22c55e', 'rgba(34,197,94,0.12)', 'Motive vendedores próximos da meta', 'GOAL_REACHED', 'SEND_WHATSAPP', 'meta'),
      t('t21', Clock, '#ef4444', 'Vendedor sem atividade X dias', 'Qualquer vendedor', Bell, '#f97316', 'Alertar líder', 'Notificação interna', '#f59e0b', 'rgba(245,158,11,0.12)', 'Alerte o líder sobre inatividade', 'INACTIVE_DAYS', 'NOTIFY_USER', 'notify'),
    ],
  },
  {
    section: 'Negócio',
    items: [
      t('t22', Check, '#22c55e', 'Venda realizada', 'Qualquer pipeline', FileText, '#3b82f6', 'Registrar no histórico de compras', 'Registro automático', '#3b82f6', 'rgba(59,130,246,0.12)', 'Registre vendas no histórico do cliente', 'STAGE_CHANGED', 'REGISTER_HISTORY', 'notify'),
      t('t23', Repeat, '#22c55e', 'Cliente comprar 2ª vez', 'Qualquer pipeline', Tag, '#a855f7', 'Tag "Cliente recorrente" + notificar', 'Tag automática', '#a855f7', 'rgba(168,85,247,0.12)', 'Identifique clientes recorrentes', 'REPEAT_PURCHASE', 'ADD_TAG', 'tag'),
      t('t24', ShieldCheck, '#a855f7', 'Solicitação de desconto', 'Qualquer lead', Bell, '#f97316', 'Notificar gestor para aprovação', 'Notificação interna', '#f59e0b', 'rgba(245,158,11,0.12)', 'Peça aprovação do gestor para descontos', 'DISCOUNT_REQUESTED', 'NOTIFY_USER', 'notify'),
      t('t25', ShieldCheck, '#22c55e', 'Desconto aprovado/recusado', 'Qualquer lead', Bell, '#f97316', 'Notificar vendedor', 'Notificação interna', '#f59e0b', 'rgba(245,158,11,0.12)', 'Avise o vendedor sobre a decisão', 'DISCOUNT_REQUESTED', 'NOTIFY_USER', 'notify'),
    ],
  },
  {
    section: 'Sistema',
    items: [
      tSys('t26', Clock, '#f59e0b', 'Plano próximo do vencimento (D-3)', 'Tenant em ACTIVE/TRIAL', Mail, '#3b82f6', 'Enviar aviso por e-mail ao gestor', 'Alerta automático 3 dias antes da expiração do plano', 'PLAN_EXPIRING', 'SEND_EMAIL'),
      tSys('t27', Plus, '#22c55e', 'Novo usuário cadastrado', 'Qualquer instância', Mail, '#3b82f6', 'Enviar e-mail de boas-vindas com senha temporária', 'Onboarding automático ao criar um usuário', 'USER_CREATED', 'SEND_EMAIL'),
      tSys('t28', ShieldCheck, '#ef4444', 'Limite de usuários do plano atingido', 'Qualquer plano', Bell, '#f97316', 'Bloquear cadastro + notificar gestor para upgrade', 'Trava automática quando o tenant atinge o teto de usuários', 'USER_LIMIT_REACHED', 'NOTIFY_USER'),
    ],
  },
]

const menuOpts = ['Editar', 'Excluir']
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

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
      const [result, pipelinesData] = await Promise.all([getAutomations(), getPipelines()])
      setAutomations(result.data)
      setMeta(result.meta)
      setPipelines(pipelinesData)
    } catch { setAutomations([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleToggleActive(a: ApiAutomation) {
    try { await updateAutomation(a.id, { isActive: !a.isActive }); loadData() } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try { await deleteAutomation(id); setOpenMenu(null); loadData() } catch { /* ignore */ }
  }

  async function handleBuilderSave(payload: { name: string; pipelineId?: string; triggerType: string; triggerConfig: Record<string, unknown>; actionType: string; actionConfig: Record<string, unknown> }) {
    await createAutomation(payload)
    setBuilder(null)
    setTab('mine')
    loadData()
  }

  if (builder) return (
    <AppLayout menuItems={gestaoMenuItems}>
      <BuilderView template={builder} pipelines={pipelines} onBack={() => setBuilder(null)} onSave={handleBuilderSave} />
    </AppLayout>
  )

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Automações</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Regras automáticas para o seu pipeline</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['templates', 'Modelos prontos'], ['mine', `Minhas automações (${automations.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 20px', fontSize: 13,
            color: tab === k ? '#f97316' : 'var(--text-muted)', fontWeight: tab === k ? 500 : 400,
            borderBottom: tab === k ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>

      {tab === 'templates' && templates.map(section => (
        <div key={section.section} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: 12 }}>{section.section}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {section.items.map(tmpl => {
              const TIcon = tmpl.triggerIcon; const AIcon = tmpl.actionIcon
              const isHov = hoveredCard === tmpl.id
              return (
                <div key={tmpl.id} onMouseEnter={() => setHoveredCard(tmpl.id)} onMouseLeave={() => setHoveredCard(null)}
                  style={{ background: 'var(--bg-card)', border: `1px solid ${isHov ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TIcon size={16} color={tmpl.triggerColor} strokeWidth={1.5} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{tmpl.triggerTitle}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tmpl.triggerSub}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>↓</div>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AIcon size={16} color={tmpl.actionColor} strokeWidth={1.5} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{tmpl.actionTitle}</div>
                      <span style={{ background: tmpl.badgeBg, color: tmpl.badgeColor, borderRadius: 4, padding: '2px 6px', fontSize: 10 }}>{tmpl.badgeLabel}</span>
                    </div>
                  </div>
                  {tmpl.system ? (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: 'rgba(168,85,247,0.12)', color: '#a855f7',
                      border: '1px solid rgba(168,85,247,0.3)',
                      borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.5px', textTransform: 'uppercase',
                    }}>Fixa do sistema</div>
                  ) : (
                    <button onClick={() => setBuilder(tmpl)} style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: '#f97316', color: '#fff', border: 'none', padding: 10,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      opacity: isHov ? 1 : 0, transition: 'opacity 0.2s',
                      borderRadius: '0 0 12px 12px',
                    }}>Usar este modelo</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {tab === 'mine' && (
        loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
            <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando automações...</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
              <span style={{ color: 'var(--text-muted)' }}>Ativas</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{meta.activeCount}</span>
              <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
              <span style={{ color: 'var(--text-muted)' }}>Pausadas</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{meta.pausedCount}</span>
              <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
              <span style={{ color: 'var(--text-muted)' }}>Execuções este mês</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{meta.executionsThisMonth}</span>
            </div>
            {automations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhuma automação criada</div>
            ) : automations.map(a => {
              const ti = triggerIcons[a.triggerType] ?? defaultIcon
              const Icon = ti.icon
              return (
                <div key={a.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 12, opacity: a.isActive ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${ti.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={ti.color} strokeWidth={1.5} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{a.name}</span>
                    <span style={{ background: a.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: a.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{a.isActive ? 'Ativa' : 'Pausada'}</span>
                    <div onClick={() => handleToggleActive(a)} style={{ width: 36, height: 20, borderRadius: 999, cursor: 'pointer', background: a.isActive ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: a.isActive ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: a.isActive ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openMenu === a.id ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <MoreHorizontal size={14} strokeWidth={1.5} />
                      </button>
                      {openMenu === a.id && (
                        <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                          {menuOpts.map(opt => (
                            <div key={opt} onClick={() => { if (opt === 'Excluir') handleDelete(a.id); else setOpenMenu(null) }}
                              style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, paddingLeft: 44 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Quando: </span>{triggerLabels[a.triggerType] ?? a.triggerType}
                    {a.pipeline && <span style={{ color: 'var(--text-muted)' }}> · {a.pipeline.name}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 44 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ação: </span>{actionLabels[a.actionType] ?? a.actionType}
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

function BuilderView({ template: tmpl, pipelines, onBack, onSave }: {
  template: Template; pipelines: PipelineOption[]
  onBack: () => void
  onSave: (p: { name: string; pipelineId?: string; triggerType: string; triggerConfig: Record<string, unknown>; actionType: string; actionConfig: Record<string, unknown> }) => void
}) {
  const [name, setName] = useState('')
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '')
  const [stageId, setStageId] = useState('')
  const [days, setDays] = useState('3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedPipeline = pipelines.find(p => p.id === pipelineId)
  const stages = selectedPipeline?.stages ?? []
  const TIcon = tmpl.triggerIcon; const AIcon = tmpl.actionIcon
  const canSave = name.trim() && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true); setError('')
    try {
      const triggerConfig: Record<string, unknown> = {}
      if (stageId) triggerConfig.stageId = stageId
      if (tmpl.triggerType === 'INACTIVE_DAYS') triggerConfig.days = parseInt(days)
      const actionConfig: Record<string, unknown> = { type: tmpl.configType }
      await onSave({ name, pipelineId, triggerType: tmpl.triggerType, triggerConfig, actionType: tmpl.actionType, actionConfig })
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao salvar automação')
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={14} strokeWidth={1.5} /> Voltar aos modelos
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 540, margin: '0 auto' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configurar automação</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 20 }}>{tmpl.builderSubtitle}</p>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Quando isso acontecer — Gatilho</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TIcon size={16} color={tmpl.triggerColor} strokeWidth={1.5} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{tmpl.triggerTitle}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tmpl.triggerSub}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId('') }} style={{ ...inputS, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {stages.length > 0 && (
              <select value={stageId} onChange={e => setStageId(e.target.value)} style={{ ...inputS, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
                <option value="">Qualquer etapa</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {tmpl.triggerType === 'INACTIVE_DAYS' && (
              <input type="number" value={days} onChange={e => setDays(e.target.value)} placeholder="Dias" style={{ ...inputS, width: 70 }} />
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 16, padding: '4px 0' }}>↓</div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Então fazer isso — Ação</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AIcon size={16} color={tmpl.actionColor} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{tmpl.actionTitle}</span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome desta automação <span style={{ color: '#f97316' }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Follow-up automático 3 dias" style={inputS} />
        </div>

        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} style={{
            background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8,
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar e ativar'}
          </button>
        </div>
      </div>
    </div>
  )
}
