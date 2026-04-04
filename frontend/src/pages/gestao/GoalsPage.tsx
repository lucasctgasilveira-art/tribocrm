import { useState, useEffect } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getGoalDashboard, getGoals } from '../../services/goals.service'

// ── Types ──

interface UserGoal {
  id: string
  userId: string
  user: { id: string; name: string }
  revenueGoal: number
  dealsGoal: number | null
  isRamping: boolean
  current: number
  percentage: number
}

interface GoalData {
  id: string
  periodType: string
  periodReference: string
  goalType: string
  totalRevenueGoal: number
  totalDealsGoal: number | null
  distributionType: string
  pipeline: { id: string; name: string } | null
  totalCurrent: number
  totalPercentage: number
  daysRemaining: number
}

interface DashboardData {
  goal: GoalData | null
  userGoals: UserGoal[]
}

interface HistoryGoal {
  id: string
  periodReference: string
  totalRevenueGoal: string | number | null
  goalType: string
}

// ── Helpers ──

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
function barColor(p: number) { return p >= 80 ? '#22c55e' : p >= 50 ? '#f97316' : '#ef4444' }
function ini(n: string) { return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

function formatPeriod(ref: string): string {
  const [year, month] = ref.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[parseInt(month!) - 1]}/${year}`
}

function currentMonthLabel(): string {
  const now = new Date()
  return now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
}

const thS: React.CSSProperties = { padding: '12px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: '#e8eaf0', borderBottom: '1px solid #22283a' }
const card: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }

// ── Component ──

export default function GoalsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [history, setHistory] = useState<HistoryGoal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dashData, goalsData] = await Promise.all([
          getGoalDashboard(),
          getGoals({ year: String(new Date().getFullYear()) }),
        ])
        setDashboard(dashData)
        setHistory(goalsData)
      } catch {
        setDashboard({ goal: null, userGoals: [] })
        setHistory([])
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
          <span style={{ fontSize: 14, color: '#6b7280' }}>Carregando metas...</span>
        </div>
      </AppLayout>
    )
  }

  const goal = dashboard?.goal
  const userGoals = dashboard?.userGoals ?? []

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Metas</h1>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{currentMonthLabel()}</span>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Nova Meta
        </button>
      </div>

      {/* No goal state */}
      {!goal ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8eaf0', marginBottom: 8 }}>Nenhuma meta configurada para este período</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Crie uma meta para acompanhar o desempenho do seu time.</div>
          <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Criar Meta
          </button>
        </div>
      ) : (
        <>
          {/* Overall progress */}
          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#e8eaf0' }}>
                Meta do Time — {currentMonthLabel()}
                {goal.pipeline && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>· {goal.pipeline.name}</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: barColor(goal.totalPercentage) }}>{goal.totalPercentage}% concluído</span>
            </div>
            <div style={{ background: '#22283a', borderRadius: 999, height: 10 }}>
              <div style={{ width: `${Math.min(goal.totalPercentage, 100)}%`, height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 10 }}>
              <span style={{ color: '#e8eaf0' }}>{fmt(goal.totalCurrent)} realizados</span>
              <span style={{ color: '#6b7280' }}>Meta: {fmt(goal.totalRevenueGoal)}</span>
              <span style={{ color: '#f59e0b' }}>Faltam {fmt(Math.max(0, goal.totalRevenueGoal - goal.totalCurrent))}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>{goal.daysRemaining} dias restantes no período</div>
          </div>

          {/* 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
            {/* Left — Individual goals */}
            <div style={card}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Meta individual</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Por receita</span>
              </div>
              {userGoals.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Nenhuma meta individual configurada</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0f1117' }}>
                      {['Vendedor', 'Meta', 'Realizado', '%', ''].map(h => <th key={h} style={thS}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {userGoals.map(ug => (
                      <tr key={ug.id} style={{ cursor: 'default' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#1c2130' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <td style={tdS}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', fontSize: 10, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(ug.user.name)}</div>
                            <div>
                              <span>{ug.user.name}</span>
                              {ug.isRamping && <span style={{ marginLeft: 6, background: 'rgba(168,85,247,0.12)', color: '#a855f7', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 500 }}>Rampagem</span>}
                            </div>
                          </div>
                        </td>
                        <td style={tdS}>{fmt(ug.revenueGoal)}</td>
                        <td style={{ ...tdS, fontWeight: 700, color: '#22c55e' }}>{fmt(ug.current)}</td>
                        <td style={{ ...tdS, fontWeight: 700, color: barColor(ug.percentage) }}>{ug.percentage}%</td>
                        <td style={{ ...tdS, width: 100 }}>
                          <div style={{ background: '#22283a', borderRadius: 3, height: 6 }}>
                            <div style={{ width: `${Math.min(ug.percentage, 100)}%`, height: '100%', background: barColor(ug.percentage), borderRadius: 3 }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right — Configuration */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Configuração da meta</div>

              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Meta atual</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <ConfigRow label="Tipo" value={goal.goalType === 'BOTH' ? 'Receita + Nº de vendas' : goal.goalType === 'REVENUE' ? 'Receita' : 'Nº de vendas'} />
                <ConfigRow label="Período" value={`${goal.periodType === 'MONTHLY' ? 'Mensal' : goal.periodType === 'QUARTERLY' ? 'Trimestral' : 'Anual'} — ${currentMonthLabel()}`} />
                <ConfigRow label="Distribuição" value={goal.distributionType === 'GENERAL' ? 'Por operador (igual)' : 'Individual (manual)'} />
                <ConfigRow label="Meta receita" value={fmt(goal.totalRevenueGoal)} valueColor="#f97316" />
                {goal.totalDealsGoal && <ConfigRow label="Meta vendas" value={`${goal.totalDealsGoal} fechamentos`} />}
              </div>
              <button style={{ width: '100%', background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Editar configuração
              </button>

              <div style={{ height: 1, background: '#22283a', margin: '20px 0' }} />

              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Vendedores em rampagem</div>
              {userGoals.filter(ug => ug.isRamping).length === 0 ? (
                <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>Nenhum vendedor em rampagem</div>
                  <button style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                    + Configurar rampagem
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {userGoals.filter(ug => ug.isRamping).map(ug => (
                    <div key={ug.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e8eaf0' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#22283a', fontSize: 9, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(ug.user.name)}</div>
                      {ug.user.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ ...card, marginTop: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Histórico de metas</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f1117' }}>
                {['Período', 'Meta', 'Tipo'].map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #22283a' }}>
                  <td style={tdS}>{formatPeriod(h.periodReference)}</td>
                  <td style={tdS}>{h.totalRevenueGoal ? fmt(Number(h.totalRevenueGoal)) : '—'}</td>
                  <td style={tdS}>{h.goalType === 'BOTH' ? 'Receita + Vendas' : h.goalType === 'REVENUE' ? 'Receita' : 'Vendas'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

function ConfigRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: valueColor ?? '#e8eaf0', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
