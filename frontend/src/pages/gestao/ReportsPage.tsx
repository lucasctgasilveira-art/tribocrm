import { useState, useEffect } from 'react'
import { TrendingUp, Users, Target, DollarSign, Download, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getGestaoReports } from '../../services/reports.service'

type Period = 'month' | 'quarter' | 'year'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
function metaColor(p: number) { return p >= 80 ? '#22c55e' : p >= 50 ? '#f97316' : '#ef4444' }

const thStyle: React.CSSProperties = { padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid #22283a' }
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getGestaoReports({ period })
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('Erro ao carregar relatórios') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [period])

  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: 'Este mês' },
    { key: 'quarter', label: 'Trimestre' },
    { key: 'year', label: 'Ano' },
  ]

  const kpis = data ? [
    { label: 'Receita Fechada', value: fmt(data.kpis.totalRevenue), icon: TrendingUp, iconColor: '#22c55e' },
    { label: 'Leads Gerados', value: String(data.kpis.totalLeads), icon: Users, iconColor: '#f97316' },
    { label: 'Taxa de Conversão', value: `${data.kpis.conversionRate}%`, icon: Target, iconColor: '#f97316' },
    { label: 'Ticket Médio', value: fmt(data.kpis.averageTicket), icon: DollarSign, iconColor: '#f97316' },
  ] : []

  const team: any[] = data?.teamPerformance ?? []
  const lossReasons: any[] = data?.lossReasons ?? []
  const activities = data?.activities ?? { calls: 0, whatsapp: 0, emails: 0, meetings: 0, visits: 0 }
  const pipelineStages: any[] = data?.pipelineByStage ?? []
  const maxPipelineValue = Math.max(...pipelineStages.map((s: any) => s.value), 0)
  const totalActivities = activities.calls + activities.whatsapp + activities.emails + activities.meetings + activities.visits

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Relatórios</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: period === p.key ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
              border: `1px solid ${period === p.key ? '#f97316' : 'var(--border)'}`,
              color: period === p.key ? '#f97316' : 'var(--text-muted)', transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          <Loader2 size={32} color="#f97316" strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {error && !loading && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 14 }}>{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {kpis.map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid #22283a', borderRadius: 12, padding: 20, position: 'relative' }}>
                  <Icon size={20} color={k.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{k.label}</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{k.value}</span>
                </div>
              )
            })}
          </div>

          {/* Row 2: Performance + Loss reasons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            {/* Performance */}
            <div style={card}>
              <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Performance por vendedor</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Por receita</span>
              </div>
              {team.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum vendedor encontrado</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                  <thead><tr style={{ background: 'var(--bg)' }}>
                    {['Vendedor', 'Leads', 'Conv.', 'Receita', 'Meta %'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {team.map((m: any) => (
                      <tr key={m.id}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {m.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                            </div>
                            <span>{m.name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>{m.leadsCount}</td>
                        <td style={tdStyle}>{m.conversionRate}%</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: '#22c55e' }}>{fmt(m.revenue)}</td>
                        <td style={{ ...tdStyle, minWidth: 90 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 2, height: 4 }}>
                              <div style={{ width: `${Math.min(m.goalPercentage, 100)}%`, height: '100%', background: metaColor(m.goalPercentage), borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, color: metaColor(m.goalPercentage), fontWeight: 600, minWidth: 28 }}>{m.goalPercentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr style={{ background: 'var(--bg)' }}>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>TOTAL</td>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>{team.reduce((s: number, m: any) => s + m.leadsCount, 0)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>{data.kpis.conversionRate}%</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#22c55e', borderBottom: 'none' }}>{fmt(team.reduce((s: number, m: any) => s + m.revenue, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Loss reasons */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Motivos de perda</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lossReasons.reduce((s: number, r: any) => s + r.count, 0)} leads perdidos</span>
              </div>
              {lossReasons.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum lead perdido no período</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {lossReasons.map((lr: any) => (
                    <div key={lr.reason}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{lr.reason}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lr.count} leads · {lr.percentage}%</span>
                      </div>
                      <div style={{ background: 'var(--border)', borderRadius: 3, height: 6 }}>
                        <div style={{ width: `${lr.percentage}%`, height: '100%', background: '#ef4444', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Activities + Pipeline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            {/* Activities */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Atividades da equipe</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{totalActivities} total</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Ligações', value: activities.calls, color: '#3b82f6' },
                  { label: 'WhatsApp', value: activities.whatsapp, color: '#22c55e' },
                  { label: 'E-mails', value: activities.emails, color: '#f97316' },
                  { label: 'Reuniões', value: activities.meetings, color: '#a855f7' },
                  { label: 'Visitas', value: activities.visits, color: '#eab308' },
                ].map(a => (
                  <div key={a.label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.value}</span>
                    </div>
                    <div style={{ background: 'var(--border)', borderRadius: 3, height: 6 }}>
                      <div style={{ width: totalActivities > 0 ? `${(a.value / totalActivities) * 100}%` : '0%', height: '100%', background: a.color, borderRadius: 3, minWidth: a.value > 0 ? 4 : 0 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline by stage */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Pipeline por etapa</span>
              </div>
              {pipelineStages.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum pipeline configurado</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {pipelineStages.map((s: any) => (
                    <div key={s.stageName}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.stageName}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {s.count} leads{s.value > 0 ? ` · ${fmt(s.value)}` : ''}
                        </span>
                      </div>
                      <div style={{ background: 'var(--border)', borderRadius: 3, height: 6 }}>
                        <div style={{ width: maxPipelineValue > 0 ? `${(s.value / maxPipelineValue) * 100}%` : '0%', height: '100%', background: s.color, borderRadius: 3, minWidth: s.value > 0 ? 4 : 0 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Export row */}
          <div style={{ ...card, padding: '16px 20px', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Exportar dados</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, color: '#f97316', cursor: 'pointer' }}>
                <Download size={14} strokeWidth={1.5} /> Exportar Excel
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <Download size={14} strokeWidth={1.5} /> Exportar CSV
              </button>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}
