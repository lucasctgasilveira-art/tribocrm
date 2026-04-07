import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, X, Info } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getGoalDashboard, getGoals, createGoal, updateGoal } from '../../services/goals.service'
import { getPipelines } from '../../services/pipeline.service'
import { getUsers, getTeams } from '../../services/users.service'

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

interface PipelineOption {
  id: string
  name: string
}

interface UserOption {
  id: string
  name: string
  role: string
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

function getPeriodReference(periodType: string): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  if (periodType === 'QUARTERLY') {
    const q = Math.floor(now.getMonth() / 3) + 1
    return `${y}-Q${q}`
  }
  if (periodType === 'YEARLY') return `${y}`
  return `${y}-${m}`
}

const thS: React.CSSProperties = { padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

// ── Component ──

export default function GoalsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [history, setHistory] = useState<HistoryGoal[]>([])
  const [pipelines, setPipelines] = useState<PipelineOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [rampModalOpen, setRampModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashData, goalsData, pipelinesData, usersData, teamsData] = await Promise.all([
        getGoalDashboard(),
        getGoals({ year: String(new Date().getFullYear()) }),
        getPipelines(),
        getUsers(),
        getTeams().catch(() => []),
      ])
      setDashboard(dashData)
      setHistory(goalsData)
      setPipelines(pipelinesData)
      setUsers(usersData)
      setTeams(teamsData)
    } catch {
      setDashboard({ goal: null, userGoals: [] })
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleEditGoal(payload: { goalType: string; totalRevenueGoal: number; distributionType: string }) {
    if (!goal) return
    try {
      await updateGoal(goal.id, payload)
      setEditModalOpen(false)
      loadData()
    } catch { /* ignore */ }
  }

  async function handleCreateGoal(payload: { periodType: string; goalType: string; totalRevenueGoal: number; distributionType: string; pipelineId: string }) {
    try {
      await createGoal({
        ...payload,
        periodReference: getPeriodReference(payload.periodType),
      })
      setModalOpen(false)
      loadData()
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <AppLayout menuItems={gestaoMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="var(--accent)" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando metas...</span>
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Metas</h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{currentMonthLabel()}</span>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Nova Meta
        </button>
      </div>

      {/* No goal state */}
      {!goal ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Nenhuma meta configurada para este período</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Crie uma meta para acompanhar o desempenho do seu time.</div>
          <button onClick={() => setModalOpen(true)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Criar Meta
          </button>
        </div>
      ) : (
        <>
          {/* Overall progress */}
          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Meta do Time — {currentMonthLabel()}
                {goal.pipeline && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>· {goal.pipeline.name}</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: barColor(goal.totalPercentage) }}>{goal.totalPercentage}% concluído</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 999, height: 10 }}>
              <div style={{ width: `${Math.min(goal.totalPercentage, 100)}%`, height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 10 }}>
              <span style={{ color: 'var(--text-primary)' }}>{fmt(goal.totalCurrent)} realizados</span>
              <span style={{ color: 'var(--text-muted)' }}>Meta: {fmt(goal.totalRevenueGoal)}</span>
              <span style={{ color: '#f59e0b' }}>Faltam {fmt(Math.max(0, goal.totalRevenueGoal - goal.totalCurrent))}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{goal.daysRemaining} dias restantes no período</div>
          </div>

          {/* 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
            {/* Left — Individual goals */}
            <div style={card}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Meta individual</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Por receita</span>
              </div>
              {userGoals.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma meta individual configurada</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      {['Vendedor', 'Meta', 'Realizado', '%', ''].map(h => <th key={h} style={thS}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {userGoals.map(ug => (
                      <tr key={ug.id} style={{ cursor: 'default' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <td style={tdS}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(ug.user.name)}</div>
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
                          <div style={{ background: 'var(--border)', borderRadius: 3, height: 6 }}>
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
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Configuração da meta</div>

              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Meta atual</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <ConfigRow label="Tipo" value={goal.goalType === 'BOTH' ? 'Receita + Nº de vendas' : goal.goalType === 'REVENUE' ? 'Receita' : 'Nº de vendas'} />
                <ConfigRow label="Período" value={`${goal.periodType === 'MONTHLY' ? 'Mensal' : goal.periodType === 'QUARTERLY' ? 'Trimestral' : 'Anual'} — ${currentMonthLabel()}`} />
                <ConfigRow label="Distribuição" value={goal.distributionType === 'GENERAL' ? 'Por operador (igual)' : 'Individual (manual)'} />
                <ConfigRow label="Meta receita" value={fmt(goal.totalRevenueGoal)} valueColor="var(--accent)" />
                {goal.totalDealsGoal && <ConfigRow label="Meta vendas" value={`${goal.totalDealsGoal} fechamentos`} />}
              </div>
              <button onClick={() => setEditModalOpen(true)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: 'var(--accent)', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Editar configuração
              </button>

              <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Vendedores em rampagem</div>
              {userGoals.filter(ug => ug.isRamping).length === 0 ? (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Nenhum vendedor em rampagem</div>
                  <button onClick={() => setRampModalOpen(true)} style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: 'var(--accent)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                    + Configurar rampagem
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {userGoals.filter(ug => ug.isRamping).map(ug => (
                    <div key={ug.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(ug.user.name)}</div>
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
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Histórico de metas</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Período', 'Meta', 'Tipo'].map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdS}>{formatPeriod(h.periodReference)}</td>
                  <td style={tdS}>{h.totalRevenueGoal ? fmt(Number(h.totalRevenueGoal)) : '—'}</td>
                  <td style={tdS}>{h.goalType === 'BOTH' ? 'Receita + Vendas' : h.goalType === 'REVENUE' ? 'Receita' : 'Vendas'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <NewGoalModal pipelines={pipelines} users={users} teams={teams} onClose={() => setModalOpen(false)} onSave={handleCreateGoal} />}
      {editModalOpen && goal && <EditGoalModal goal={goal} onClose={() => setEditModalOpen(false)} onSave={handleEditGoal} />}
      {rampModalOpen && goal && <RampModal goalId={goal.id} onClose={() => setRampModalOpen(false)} onSaved={loadData} />}
    </AppLayout>
  )
}

// ── New Goal Modal ──

function NewGoalModal({ pipelines, users, teams, onClose, onSave }: {
  pipelines: PipelineOption[]
  users: UserOption[]
  teams: { id: string; name: string }[]
  onClose: () => void
  onSave: (p: { periodType: string; goalType: string; totalRevenueGoal: number; distributionType: string; pipelineId: string }) => void
}) {
  const [goalType, setGoalType] = useState('REVENUE')
  const [periodType, setPeriodType] = useState('MONTHLY')
  const [totalRevenueGoal, setTotalRevenueGoal] = useState('')
  const [distributionType, setDistributionType] = useState('GENERAL')
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [userGoalValues, setUserGoalValues] = useState<Record<string, string>>({})
  const [teamMode, setTeamMode] = useState<'all' | 'per_team'>('all')
  const [_selectedTeamId] = useState(teams[0]?.id ?? '') // reserved for future team selection
  const [teamGoalValues, setTeamGoalValues] = useState<Record<string, string>>({})
  const hasMultipleTeams = teams.length > 1

  const sellers = users.filter(u => u.role === 'SELLER' || u.role === 'TEAM_LEADER')
  const individualTotal = Object.values(userGoalValues).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const teamTotal = Object.values(teamGoalValues).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const effectiveTotal = distributionType === 'INDIVIDUAL' ? individualTotal : parseFloat(totalRevenueGoal) || 0
  const canSave = effectiveTotal > 0 && pipelineId

  function handleSave() {
    if (!canSave) return
    setSaving(true)
    onSave({ periodType, goalType, totalRevenueGoal: effectiveTotal, distributionType, pipelineId })
  }

  function setUserGoal(userId: string, value: string) {
    setUserGoalValues(prev => ({ ...prev, [userId]: value }))
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nova Meta</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Pipeline */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Pipeline</label>
            <select value={pipelineId} onChange={e => setPipelineId(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Goal type */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tipo de meta</label>
            <select value={goalType} onChange={e => setGoalType(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="REVENUE">Receita</option>
              <option value="DEALS">Vendas (nº de fechamentos)</option>
              <option value="BOTH">Receita e Vendas</option>
            </select>
          </div>

          {/* Period */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Período</label>
            <select value={periodType} onChange={e => setPeriodType(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="MONTHLY">Mensal</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="YEARLY">Anual</option>
            </select>
          </div>

          {/* Value */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Valor da meta (R$) <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input type="number" value={totalRevenueGoal} onChange={e => setTotalRevenueGoal(e.target.value)} placeholder="Ex: 100000" style={inputS} />
          </div>

          {/* Distribution */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Distribuição</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { value: 'GENERAL', label: 'Geral para equipe', desc: 'Meta dividida igualmente entre os vendedores' },
                { value: 'INDIVIDUAL', label: 'Por operador', desc: 'Meta individual definida manualmente para cada vendedor' },
              ] as const).map(opt => (
                <label key={opt.value} onClick={() => setDistributionType(opt.value)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: `1px solid ${distributionType === opt.value ? 'var(--accent)' : 'var(--border)'}`, background: distributionType === opt.value ? 'rgba(249,115,22,0.06)' : 'transparent', transition: 'all 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${distributionType === opt.value ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {distributionType === opt.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Multi-team configuration */}
          {hasMultipleTeams && distributionType === 'GENERAL' && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Equipes</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {([
                  { value: 'all' as const, label: 'Todas as equipes (igual)', desc: 'Mesma meta para todas as equipes' },
                  { value: 'per_team' as const, label: 'Por equipe', desc: 'Meta diferente para cada equipe' },
                ]).map(opt => (
                  <label key={opt.value} onClick={() => setTeamMode(opt.value)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, border: `1px solid ${teamMode === opt.value ? 'var(--accent)' : 'var(--border)'}`, background: teamMode === opt.value ? 'rgba(249,115,22,0.06)' : 'transparent', transition: 'all 0.15s' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${teamMode === opt.value ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      {teamMode === opt.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              {teamMode === 'per_team' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {teams.map(team => (
                    <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{team.name}</span>
                      <input type="number" value={teamGoalValues[team.id] ?? ''} onChange={e => setTeamGoalValues(prev => ({ ...prev, [team.id]: e.target.value }))} placeholder="0" style={{ ...inputS, width: 120, textAlign: 'right' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Total:</span>
                    <span style={{ color: 'var(--accent)' }}>{fmt(teamTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Individual user goals */}
          {distributionType === 'INDIVIDUAL' && sellers.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Meta por vendedor (R$)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sellers.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(u.name)}</div>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 100 }}>{u.name}</span>
                    <input type="number" value={userGoalValues[u.id] ?? ''} onChange={e => setUserGoal(u.id, e.target.value)} placeholder="0" style={{ ...inputS, width: 120, textAlign: 'right' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Total:</span>
                <span style={{ color: 'var(--accent)' }}>{fmt(individualTotal)}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave || saving} style={{
            background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600,
            color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Criando...' : 'Criar Meta'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Edit Goal Modal ──

function EditGoalModal({ goal, onClose, onSave }: { goal: GoalData; onClose: () => void; onSave: (p: { goalType: string; totalRevenueGoal: number; distributionType: string }) => void }) {
  const [goalType, setGoalType] = useState(goal.goalType)
  const [totalRevenueGoal, setTotalRevenueGoal] = useState(String(goal.totalRevenueGoal))
  const [distributionType, setDistributionType] = useState(goal.distributionType)

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const canSave = totalRevenueGoal.trim() && parseFloat(totalRevenueGoal) > 0

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Editar Meta</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tipo de meta</label>
            <select value={goalType} onChange={e => setGoalType(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="REVENUE">Receita</option>
              <option value="DEALS">Vendas</option>
              <option value="BOTH">Receita e Vendas</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Valor da meta (R$) <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input type="number" value={totalRevenueGoal} onChange={e => setTotalRevenueGoal(e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Distribuição</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['GENERAL', 'INDIVIDUAL'] as const).map(v => (
                <label key={v} onClick={() => setDistributionType(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${distributionType === v ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {distributionType === v && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                  </div>
                  {v === 'GENERAL' ? 'Geral para equipe' : 'Por operador'}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (canSave) onSave({ goalType, totalRevenueGoal: parseFloat(totalRevenueGoal), distributionType }) }} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>Salvar</button>
        </div>
      </div>
    </>
  )
}

// ── Ramp Modal ──

function RampModal({ goalId, onClose, onSaved }: { goalId: string; onClose: () => void; onSaved: () => void }) {
  const [m1, setM1] = useState('50')
  const [m2, setM2] = useState('75')
  const [m3, setM3] = useState('100')
  const [saving, setSaving] = useState(false)

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }

  async function handleSave() {
    setSaving(true)
    try {
      await updateGoal(goalId, { rampConfig: { month1: parseInt(m1), month2: parseInt(m2), month3: parseInt(m3) } })
      onSaved()
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configurar Rampagem</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Info size={14} color="#3b82f6" strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>Vendedores em rampagem terão meta reduzida nos primeiros meses.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Mês 1', value: m1, set: setM1 },
              { label: 'Mês 2', value: m2, set: setM2 },
              { label: 'Mês 3', value: m3, set: setM3 },
            ].map(item => (
              <div key={item.label}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textAlign: 'center' }}>{item.label}</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" value={item.value} onChange={e => item.set(e.target.value)} style={inputS} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
            {[m1, m2, m3].map((v, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${parseInt(v) >= 100 ? '#22c55e' : parseInt(v) >= 75 ? '#f97316' : '#f59e0b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{v}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Mês {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar Rampagem'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──

function ConfigRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: valueColor ?? 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
