import { useState, useEffect } from 'react'
import {
  TrendingUp, CheckCircle2, Target, Trophy, Loader2,
  MessageCircle, Mail, Phone, Video,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import { getDashboard, exportVendedorReport } from '../../services/reports.service'
import { getGoalDashboard } from '../../services/goals.service'
import PeriodPicker, { type PeriodValue } from '../../components/shared/PeriodPicker/PeriodPicker'

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

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

// Period-aware goal label. Fixes prior bug where the heading was
// hardcoded to the current calendar month regardless of which period
// the user had selected.
function goalLabel(pv: PeriodValue): string {
  switch (pv.period) {
    case 'today': return 'Minha Meta de hoje'
    case 'week': return 'Minha Meta desta semana'
    case 'quarter': return 'Minha Meta do trimestre'
    case 'year': return 'Minha Meta do ano'
    case 'custom': return 'Minha Meta do período'
    default: return `Minha Meta de ${new Date().toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}`
  }
}

// ── Component ──

export default function MyResultsPage() {
  const [revenue, setRevenue] = useState(0)
  const [conversionRate, setConversionRate] = useState(0)
  const [goalInfo, setGoalInfo] = useState<GoalInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodValue, setPeriodValue] = useState<PeriodValue>({ period: 'month' })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dash, goals] = await Promise.all([
          getDashboard(periodValue.period, periodValue.startDate, periodValue.endDate),
          getGoalDashboard(),
        ])
        setRevenue(dash.kpis.revenueThisMonth)
        setConversionRate(dash.kpis.conversionRate)
        setGoalInfo(goals)
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
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando resultados...</span>
        </div>
      </AppLayout>
    )
  }

  const userId = getUserId()
  const myGoal = goalInfo?.userGoals.find(ug => ug.userId === userId)
  const teamSize = goalInfo?.userGoals.length ?? 0
  const myPosition = goalInfo?.userGoals
    .sort((a, b) => b.current - a.current)
    .findIndex(ug => ug.userId === userId) ?? -1
  const position = myPosition >= 0 ? myPosition + 1 : null

  const kpiCards = [
    { label: 'Receita Fechada', value: fmt(revenue), icon: TrendingUp, iconColor: '#22c55e' },
    { label: 'Taxa de Conversão', value: `${conversionRate}%`, icon: Target, iconColor: '#f97316' },
    { label: 'Meta Atingida', value: myGoal ? `${myGoal.percentage}%` : '—', icon: CheckCircle2, iconColor: '#f97316' },
    { label: 'Receita Meta', value: myGoal ? fmt(myGoal.revenueGoal) : '—', icon: Trophy, iconColor: '#f59e0b' },
  ]

  return (
    <AppLayout menuItems={vendasMenuItems}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Meus Resultados</h1>
        <PeriodPicker
          value={periodValue}
          onChange={setPeriodValue}
          showExport
          onExport={handleExport}
          exportLoading={exporting}
        />
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpiCards.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={k.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{k.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{k.value}</span>
            </div>
          )
        })}
      </div>

      {/* Goal progress */}
      <div style={{ ...card, padding: 20, marginTop: 20 }}>
        {myGoal ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {goalLabel(periodValue)}
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
            {goalInfo?.goal && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{goalInfo.goal.daysRemaining} dias restantes</div>}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma meta configurada para este mês.</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Ranking */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Ranking Pessoal</div>
          {position && teamSize > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trophy size={28} color="#f59e0b" strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>{position}º</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>lugar · equipe de {teamSize} pessoa{teamSize > 1 ? 's' : ''}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
              <Trophy size={24} color="#f59e0b" strokeWidth={1.5} />
              <div style={{ marginTop: 8 }}>Ranking será exibido quando houver dados</div>
            </div>
          )}
        </div>

        {/* Activity History */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Histórico de Atividades</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: MessageCircle, color: '#25d166', label: 'WhatsApp', count: 0 },
              { icon: Mail, color: '#3b82f6', label: 'E-mail', count: 0 },
              { icon: Phone, color: '#f97316', label: 'Ligação', count: 0 },
              { icon: Video, color: '#a855f7', label: 'Reunião', count: 0 },
            ].map(a => {
              const Icon = a.icon
              return (
                <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${a.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={a.color} strokeWidth={1.5} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{a.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{a.count}</span>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>Contadores serão atualizados conforme você registrar interações.</div>
        </div>
      </div>

      {/* Loss reasons */}
      <div style={{ ...card, padding: 20, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Meus Motivos de Perda</div>
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhum lead perdido neste período.
        </div>
      </div>
    </AppLayout>
  )
}
