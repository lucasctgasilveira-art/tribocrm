import { useState, useEffect } from 'react'
import {
  Users, CheckSquare, TrendingUp, Trophy, Loader2,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import { useNavigate } from 'react-router-dom'
import { getDashboard, exportVendedorReport } from '../../services/reports.service'
import { getGoalDashboard } from '../../services/goals.service'
import { getTasks } from '../../services/tasks.service'
import PeriodPicker, { type PeriodValue } from '../../components/shared/PeriodPicker/PeriodPicker'

// ── Types ──

interface DashData {
  kpis: { revenueThisMonth: number; pipelineTotal: number; conversionRate: number }
  inactiveLeads: { id: string; name: string; company: string | null; daysSinceContact: number | null; stage: { name: string } }[]
}

interface GoalUser {
  userId: string
  revenueGoal: number
  current: number
  percentage: number
}

interface GoalInfo {
  goal: { totalRevenueGoal: number; totalCurrent: number; totalPercentage: number; daysRemaining: number } | null
  userGoals: GoalUser[]
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
    return u.name?.split(' ')[0] ?? 'Vendedor'
  } catch { return 'Vendedor' }
}

function getUserId(): string {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string }
    return u.id ?? ''
  } catch { return '' }
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function ini(n: string): string {
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function barColor(p: number) { return p >= 80 ? '#22c55e' : p >= 50 ? '#f97316' : '#ef4444' }

// ── Component ──

export default function VendasDashboardPage() {
  const navigate = useNavigate()
  const [dashData, setDashData] = useState<DashData | null>(null)
  const [goalInfo, setGoalInfo] = useState<GoalInfo | null>(null)
  const [pendingTasks, setPendingTasks] = useState(0)
  const [loading, setLoading] = useState(true)
  const [periodValue, setPeriodValue] = useState<PeriodValue>({ period: 'month' })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dash, goals, tasks] = await Promise.all([
          getDashboard(periodValue.period, periodValue.startDate, periodValue.endDate),
          getGoalDashboard(),
          getTasks({ status: 'PENDING', dueDate: 'today', perPage: 1 }),
        ])
        setDashData(dash)
        setGoalInfo(goals)
        setPendingTasks(tasks.meta.total)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [periodValue])

  async function handleExport() {
    setExporting(true)
    try {
      await exportVendedorReport({
        period: periodValue.period,
        startDate: periodValue.startDate,
        endDate: periodValue.endDate,
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout menuItems={vendasMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando dashboard...</span>
        </div>
      </AppLayout>
    )
  }

  const kpis = dashData?.kpis
  const inactiveLeads = dashData?.inactiveLeads ?? []

  // Find current user's goal
  const userId = getUserId()
  const myGoal = goalInfo?.userGoals.find(ug => ug.userId === userId)
  const goalData = goalInfo?.goal

  const kpiCards = [
    { label: 'Meus Leads Ativos', value: kpis ? String(Math.round(kpis.pipelineTotal / 1000)) : '0', icon: Users, iconColor: '#f97316' },
    { label: 'Tarefas Hoje', value: String(pendingTasks), icon: CheckSquare, iconColor: '#f97316' },
    { label: 'Minhas Vendas no Mês', value: fmt(kpis?.revenueThisMonth ?? 0), icon: TrendingUp, iconColor: '#22c55e' },
    { label: 'Taxa de Conversão', value: `${kpis?.conversionRate ?? 0}%`, icon: Trophy, iconColor: '#f59e0b' },
  ]

  return (
    <AppLayout menuItems={vendasMenuItems}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {getGreeting()}, {getUserFirstName()}!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Veja como está seu desempenho hoje.</p>
      </div>

      {/* Period filter + Export */}
      <div style={{ marginBottom: 20 }}>
        <PeriodPicker
          value={periodValue}
          onChange={setPeriodValue}
          showExport
          onExport={handleExport}
          exportLoading={exporting}
        />
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={kpi.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{kpi.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{kpi.value}</span>
            </div>
          )
        })}
      </div>

      {/* Goal Progress */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 20 }}>
        {myGoal ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Minha Meta de {new Date().toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: barColor(myGoal.percentage) }}>{myGoal.percentage}% concluído</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 999, height: 8, margin: '12px 0' }}>
              <div style={{ width: `${Math.min(myGoal.percentage, 100)}%`, height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-primary)' }}>{fmt(myGoal.current)} realizados</span>
              <span style={{ color: 'var(--text-muted)' }}>Meta: {fmt(myGoal.revenueGoal)}</span>
              <span style={{ color: '#22c55e' }}>Faltam {fmt(Math.max(0, myGoal.revenueGoal - myGoal.current))}</span>
            </div>
            {goalData && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{goalData.daysRemaining} dias restantes</div>}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma meta configurada para este mês.</div>
        )}
      </div>

      {/* Inactive leads */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Leads sem interação</span>
          <span onClick={() => navigate('/vendas/pipeline')} style={{ fontSize: 12, color: '#f97316', cursor: 'pointer' }}>Ver pipeline →</span>
        </div>
        {inactiveLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Todos os leads estão em dia</div>
        ) : inactiveLeads.map((lead, i) => (
          <div key={lead.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < inactiveLeads.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(lead.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{lead.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.company ?? '—'} · {lead.stage.name}</div>
            </div>
            <span style={{ fontSize: 11, color: lead.daysSinceContact !== null && lead.daysSinceContact >= 6 ? '#ef4444' : '#f59e0b', background: lead.daysSinceContact !== null && lead.daysSinceContact >= 6 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0 }}>
              {lead.daysSinceContact !== null ? `${lead.daysSinceContact}d` : 'Nunca'}
            </span>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
