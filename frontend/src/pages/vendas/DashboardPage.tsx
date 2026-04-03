import {
  Users, CheckSquare, TrendingUp, Trophy,
  Phone, MessageCircle, Mail, Video,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

// ── Helpers ──

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getUserFirstName(): string {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string }
    return u.name?.split(' ')[0] ?? 'Vendedor'
  } catch { return 'Vendedor' }
}

// ── KPI Data ──

const kpis = [
  { label: 'Meus Leads Ativos', value: '18', variation: '↑ +3 esta semana', variationColor: '#22c55e', icon: Users, iconColor: '#f97316' },
  { label: 'Tarefas Hoje', value: '5', variation: '2 atrasadas', variationColor: '#ef4444', icon: CheckSquare, iconColor: '#f97316' },
  { label: 'Minhas Vendas no Mês', value: 'R$ 38.000', variation: '↑ 95% da meta', variationColor: '#22c55e', icon: TrendingUp, iconColor: '#22c55e' },
  { label: 'Posição no Ranking', value: '1º lugar', variation: 'equipe de 5 pessoas', variationColor: '#9ca3af', icon: Trophy, iconColor: '#f59e0b' },
]

// ── Tasks Data ──

interface TaskItem {
  icon: LucideIcon
  iconColor: string
  title: string
  leadInfo: string
  time: string
  timeBadge?: { text: string; color: string; bg: string }
}

const tasks: TaskItem[] = [
  { icon: Phone, iconColor: '#f97316', title: 'Ligar para Camila Torres', leadInfo: 'Torres & Filhos · Negociando', time: '', timeBadge: { text: 'Atrasada', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' } },
  { icon: MessageCircle, iconColor: '#25d166', title: 'WhatsApp para Rafael Mendes', leadInfo: 'MendesNet · Em Contato', time: '14:00' },
  { icon: Mail, iconColor: '#3b82f6', title: 'Enviar proposta para Ana Lima', leadInfo: 'Lima Dist. · Proposta Enviada', time: '15:30' },
  { icon: Video, iconColor: '#a855f7', title: 'Reunião demo — GomesTech', leadInfo: 'Em Contato', time: '16:00' },
  { icon: Phone, iconColor: '#f97316', title: 'Follow-up Thiago Bastos', leadInfo: 'Bastos & Co · Negociando', time: '18:00' },
]

// ── Hot Leads Data ──

const hotLeads = [
  { initials: 'CT', name: 'Camila Torres', detail: 'Torres & Filhos · Negociando', days: 2 },
  { initials: 'PG', name: 'Priscila Gomes', detail: 'GomesTech · Proposta Enviada', days: 3 },
  { initials: 'RM', name: 'Rafael Mendes', detail: 'MendesNet · Em Contato', days: 2 },
]

// ── Pipeline Summary Data ──

const pipelineSummary = [
  { name: 'Sem Contato', color: '#6b7280', count: 3, value: 'R$ 24k' },
  { name: 'Em Contato', color: '#3b82f6', count: 5, value: 'R$ 42k' },
  { name: 'Negociando', color: '#f59e0b', count: 4, value: 'R$ 87k' },
  { name: 'Proposta Enviada', color: '#a855f7', count: 4, value: 'R$ 96k' },
  { name: 'Venda Realizada', color: '#22c55e', count: 2, value: 'R$ 38k' },
]

// ── Component ──

export default function VendasDashboardPage() {
  const navigate = useNavigate()

  return (
    <AppLayout menuItems={vendasMenuItems}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>
          {getGreeting()}, {getUserFirstName()}!
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          Veja como está seu desempenho hoje.
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={kpi.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>{kpi.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', display: 'block' }}>{kpi.value}</span>
              <span style={{ fontSize: 12, color: kpi.variationColor, marginTop: 4, display: 'block' }}>{kpi.variation}</span>
            </div>
          )
        })}
      </div>

      {/* Goal Progress */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Minha Meta de Abril</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>95% concluído</span>
        </div>
        <div style={{ background: '#22283a', borderRadius: 999, height: 8, margin: '12px 0' }}>
          <div style={{ width: '95%', height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: '#e8eaf0' }}>R$ 38.000 realizados</span>
          <span style={{ color: '#6b7280' }}>Meta: R$ 40.000</span>
          <span style={{ color: '#22c55e' }}>Faltam R$ 2.000</span>
        </div>
      </div>

      {/* Tasks + Hot Leads row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Today's tasks */}
        <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>O que fazer hoje</span>
            <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>5</span>
          </div>
          {tasks.map((task, i) => {
            const Icon = task.icon
            return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < tasks.length - 1 ? '1px solid #22283a' : 'none' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${task.iconColor}1A`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={task.iconColor} strokeWidth={1.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{task.leadInfo}</div>
                </div>
                {task.timeBadge ? (
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0,
                    background: task.timeBadge.bg, color: task.timeBadge.color, marginTop: 2,
                  }}>
                    {task.timeBadge.text}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: '#f97316', flexShrink: 0, marginTop: 2 }}>{task.time}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Hot leads */}
        <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Leads quentes</span>
            <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>🔥 3</span>
          </div>
          {hotLeads.map((lead, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: i < hotLeads.length - 1 ? '1px solid #22283a' : 'none' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', fontSize: 10, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {lead.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{lead.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{lead.detail}</div>
                </div>
                <span style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  sem contato há {lead.days}d
                </span>
              </div>
              <div style={{ marginTop: 8, paddingLeft: 40 }}>
                <button style={{
                  background: 'rgba(249,115,22,0.1)', color: '#f97316',
                  border: '1px solid rgba(249,115,22,0.2)', borderRadius: 6,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                  Contatar agora
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline summary */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Meu Pipeline</span>
          <span
            onClick={() => navigate('/vendas/pipeline')}
            style={{ fontSize: 12, color: '#f97316', cursor: 'pointer' }}
          >
            Ver completo →
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {pipelineSummary.map((stage) => (
            <div key={stage.name}>
              <div style={{ fontSize: 12, color: stage.color, marginBottom: 6 }}>{stage.name}</div>
              <div style={{ height: 3, borderRadius: 2, background: stage.color, marginBottom: 8 }} />
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0' }}>
                {stage.count} <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}>leads</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{stage.value}</div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
