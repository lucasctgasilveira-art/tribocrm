import { useState, useEffect } from 'react'
import {
  TrendingUp, CheckCircle2, Target, Trophy, Loader2,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import { getDashboard } from '../../services/reports.service'
import { getGoalDashboard } from '../../services/goals.service'

// ── Types ──

interface GoalUser {
  userId: string
  revenueGoal: number
  current: number
  percentage: number
}

interface GoalInfo {
  goal: { totalRevenueGoal: number; daysRemaining: number } | null
  userGoals: GoalUser[]
}

// ── Helpers ──

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
function barColor(p: number) { return p >= 80 ? '#22c55e' : p >= 50 ? '#f97316' : '#ef4444' }

function getUserId(): string {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string }
    return u.id ?? ''
  } catch { return '' }
}

const card: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }

// ── Component ──

export default function MyResultsPage() {
  const [revenue, setRevenue] = useState(0)
  const [conversionRate, setConversionRate] = useState(0)
  const [goalInfo, setGoalInfo] = useState<GoalInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dash, goals] = await Promise.all([
          getDashboard('month'),
          getGoalDashboard(),
        ])
        setRevenue(dash.kpis.revenueThisMonth)
        setConversionRate(dash.kpis.conversionRate)
        setGoalInfo(goals)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <AppLayout menuItems={vendasMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: '#6b7280' }}>Carregando resultados...</span>
        </div>
      </AppLayout>
    )
  }

  const userId = getUserId()
  const myGoal = goalInfo?.userGoals.find(ug => ug.userId === userId)

  const kpiCards = [
    { label: 'Receita Fechada', value: fmt(revenue), icon: TrendingUp, iconColor: '#22c55e' },
    { label: 'Taxa de Conversão', value: `${conversionRate}%`, icon: Target, iconColor: '#f97316' },
    { label: 'Meta Atingida', value: myGoal ? `${myGoal.percentage}%` : '—', icon: CheckCircle2, iconColor: '#f97316' },
    { label: 'Receita Meta', value: myGoal ? fmt(myGoal.revenueGoal) : '—', icon: Trophy, iconColor: '#f59e0b' },
  ]

  return (
    <AppLayout menuItems={vendasMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Meus Resultados</h1>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpiCards.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={k.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>{k.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', display: 'block' }}>{k.value}</span>
            </div>
          )
        })}
      </div>

      {/* Goal progress */}
      <div style={{ ...card, padding: 20, marginTop: 20 }}>
        {myGoal ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>
                Minha Meta de {new Date().toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: barColor(myGoal.percentage) }}>{myGoal.percentage}% concluído</span>
            </div>
            <div style={{ background: '#22283a', borderRadius: 999, height: 8, margin: '12px 0' }}>
              <div style={{ width: `${Math.min(myGoal.percentage, 100)}%`, height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#e8eaf0' }}>{fmt(myGoal.current)} realizados</span>
              <span style={{ color: '#6b7280' }}>Meta: {fmt(myGoal.revenueGoal)}</span>
              <span style={{ color: '#22c55e' }}>Faltam {fmt(Math.max(0, myGoal.revenueGoal - myGoal.current))}</span>
            </div>
            {goalInfo?.goal && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>{goalInfo.goal.daysRemaining} dias restantes</div>}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 12, color: '#6b7280', fontSize: 13 }}>Nenhuma meta configurada para este mês.</div>
        )}
      </div>

      {/* Ranking placeholder */}
      <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginTop: 20, textAlign: 'center' }}>
        <Trophy size={24} color="#f59e0b" strokeWidth={1.5} />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginTop: 8 }}>Ranking disponível em breve</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>O ranking completo é visível apenas para o gestor.</div>
      </div>
    </AppLayout>
  )
}
