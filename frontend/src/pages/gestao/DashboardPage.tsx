import { useState, useEffect } from 'react'
import { TrendingUp, Target, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Kanban } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getDashboard } from '../../services/reports.service'

// ── Types ──

interface KpiData {
  revenueThisMonth: number
  pipelineTotal: number
  conversionRate: number
  pendingApprovalsCount: number
}

interface GoalData {
  target: number
  current: number
  percentage: number
}

interface TeamMember {
  id: string
  name: string
  role: string
  leadsCount: number
  closingsCount: number
  conversionRate: number
  revenue: number
}

interface Approval {
  id: string
  lead: { id: string; name: string }
  product: { id: string; name: string }
  requestedBy: { id: string; name: string }
  originalPrice: number
  requestedPrice: number
  discountPercent: number
  createdAt: string
}

interface InactiveLead {
  id: string
  name: string
  company: string | null
  lastActivityAt: string | null
  daysSinceContact: number | null
  responsible: { id: string; name: string }
  stage: { id: string; name: string }
}

interface DashboardData {
  kpis: KpiData
  goal: GoalData | null
  teamPerformance: TeamMember[]
  pendingApprovals: Approval[]
  inactiveLeads: InactiveLead[]
}

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
    return u.name?.split(' ')[0] ?? 'Gestor'
  } catch { return 'Gestor' }
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function ini(n: string): string {
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function metaColor(pct: number): string {
  if (pct >= 80) return '#22c55e'
  if (pct >= 50) return '#f97316'
  return '#ef4444'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'agora'
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  return `há ${days}d`
}

// ── Component ──

export default function GestaoDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await getDashboard('month')
        setData(result)
      } catch {
        setError('Erro ao carregar dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <AppLayout menuItems={gestaoMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: '#6b7280' }}>Carregando dashboard...</span>
        </div>
      </AppLayout>
    )
  }

  if (error || !data) {
    return (
      <AppLayout menuItems={gestaoMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 14, color: '#ef4444' }}>{error ?? 'Erro desconhecido'}</span>
          <button onClick={() => window.location.reload()} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      </AppLayout>
    )
  }

  const { kpis, goal, teamPerformance, pendingApprovals, inactiveLeads } = data

  const kpiCards = [
    { label: 'Receita no Mês', value: fmt(kpis.revenueThisMonth), icon: TrendingUp, iconColor: '#f97316' },
    { label: 'Pipeline Total', value: fmt(kpis.pipelineTotal), icon: Kanban, iconColor: '#f97316' },
    { label: 'Taxa de Conversão', value: `${kpis.conversionRate}%`, icon: Target, iconColor: '#f97316' },
    { label: 'Aprovações pendentes', value: String(kpis.pendingApprovalsCount), icon: Clock, iconColor: kpis.pendingApprovalsCount > 0 ? '#f59e0b' : '#6b7280' },
  ]

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>
          {getGreeting()}, {getUserFirstName()}!
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          Aqui está o resumo do seu time hoje.
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={kpi.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>{kpi.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', display: 'block' }}>{kpi.value}</span>
            </div>
          )
        })}
      </div>

      {/* Goal Progress */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginTop: 20 }}>
        {goal ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Meta de {new Date().toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())} — Receita</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: metaColor(goal.percentage) }}>{goal.percentage}% concluído</span>
            </div>
            <div style={{ background: '#22283a', borderRadius: 999, height: 8, margin: '12px 0' }}>
              <div style={{ width: `${Math.min(goal.percentage, 100)}%`, height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#e8eaf0' }}>{fmt(goal.current)} realizados</span>
              <span style={{ color: '#6b7280' }}>Meta: {fmt(goal.target)}</span>
              <span style={{ color: '#f59e0b' }}>Faltam {fmt(Math.max(0, goal.target - goal.current))}</span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 12, color: '#6b7280', fontSize: 13 }}>
            Nenhuma meta cadastrada para este mês.
          </div>
        )}
      </div>

      {/* Team Performance Table */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, marginTop: 20, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Performance da equipe</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Por receita · {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</span>
        </div>
        {teamPerformance.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#6b7280', fontSize: 13 }}>Nenhum dado disponível</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f1117' }}>
                {['Vendedor', 'Leads', 'Fechamentos', 'Conversão', 'Receita'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamPerformance.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #22283a' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', fontSize: 10, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {ini(m.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{m.role}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{m.leadsCount}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{m.closingsCount}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{m.conversionRate}%</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500, color: '#22c55e' }}>{fmt(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approvals + Stale Leads row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Approvals */}
        <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Aprovações pendentes</span>
            {kpis.pendingApprovalsCount > 0 && (
              <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{kpis.pendingApprovalsCount}</span>
            )}
          </div>
          {pendingApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 13 }}>Nenhuma aprovação pendente</div>
          ) : pendingApprovals.map((a, i) => (
            <div key={a.id} style={{ padding: '12px 0', borderBottom: i < pendingApprovals.length - 1 ? '1px solid #22283a' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>Desconto {a.discountPercent}% — {a.product.name}</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{timeAgo(a.createdAt)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{a.requestedBy.name} → {a.lead.name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{fmt(a.originalPrice)} → {fmt(a.requestedPrice)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={12} strokeWidth={2} /> Aprovar
                </button>
                <button style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <XCircle size={12} strokeWidth={2} /> Recusar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Stale Leads */}
        <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Leads sem interação</span>
            {inactiveLeads.length > 0 && (
              <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>5d+</span>
            )}
          </div>
          {inactiveLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 13 }}>Todos os leads estão em dia</div>
          ) : inactiveLeads.map((lead, i) => {
            const days = lead.daysSinceContact
            const dayColor = days !== null && days >= 6 ? '#ef4444' : '#f59e0b'
            return (
              <div key={lead.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < inactiveLeads.length - 1 ? '1px solid #22283a' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', fontSize: 10, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {ini(lead.responsible.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{lead.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{lead.company ?? '—'} · {lead.stage.name}</div>
                </div>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0,
                  background: days !== null && days >= 6 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                  color: dayColor,
                }}>
                  {days !== null ? `${days}d` : 'Nunca'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
