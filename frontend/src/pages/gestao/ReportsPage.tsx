import { useState } from 'react'
import { TrendingUp, Users, Target, DollarSign, Download } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

// ── Data ──

type Period = 'month' | 'quarter' | 'semester' | 'year'

const kpis = [
  { label: 'Receita Fechada', value: 'R$ 87.500', variation: '↑ 87,5% da meta · Meta R$ 100.000', variationColor: '#22c55e', icon: TrendingUp, iconColor: '#22c55e' },
  { label: 'Leads Gerados', value: '47', variation: '↑ +12 vs mês ant.', variationColor: '#22c55e', icon: Users, iconColor: '#f97316' },
  { label: 'Taxa de Conversão', value: '22,5%', variation: '↑ +1,2pp vs mês ant.', variationColor: '#22c55e', icon: Target, iconColor: '#f97316' },
  { label: 'Ticket Médio', value: 'R$ 8.750', variation: '↑ +5% vs mês ant.', variationColor: '#22c55e', icon: DollarSign, iconColor: '#f97316' },
]

const teamPerf = [
  { initials: 'PG', name: 'Pedro Gomes', leads: 38, conv: '23%', revenue: 'R$ 78.000', metaPct: 98 },
  { initials: 'AN', name: 'Ana Souza', leads: 32, conv: '18%', revenue: 'R$ 54.000', metaPct: 68 },
  { initials: 'LC', name: 'Lucas Castro', leads: 29, conv: '17%', revenue: 'R$ 43.000', metaPct: 54 },
  { initials: 'MR', name: 'Mariana Reis', leads: 24, conv: '16%', revenue: 'R$ 31.000', metaPct: 39 },
  { initials: 'TB', name: 'Thiago Bastos', leads: 18, conv: '11%', revenue: 'R$ 17.000', metaPct: 21 },
]

const lossReasons = [
  { reason: 'Preço alto', count: 3, pct: 37, color: '#ef4444' },
  { reason: 'Sem orçamento', count: 2, pct: 25, color: '#f59e0b' },
  { reason: 'Escolheu concorrente', count: 2, pct: 25, color: '#f59e0b' },
  { reason: 'Sem interesse', count: 1, pct: 13, color: '#6b7280' },
]

const activities = [
  { initials: 'PG', name: 'Pedro Gomes', calls: 24, whatsapp: 18, emails: 12, meetings: 6, total: 60 },
  { initials: 'AN', name: 'Ana Souza', calls: 19, whatsapp: 22, emails: 15, meetings: 4, total: 60 },
  { initials: 'LC', name: 'Lucas Castro', calls: 15, whatsapp: 14, emails: 10, meetings: 3, total: 42 },
  { initials: 'MR', name: 'Mariana Reis', calls: 12, whatsapp: 10, emails: 8, meetings: 2, total: 32 },
  { initials: 'TB', name: 'Thiago Bastos', calls: 8, whatsapp: 6, emails: 5, meetings: 1, total: 20 },
]

const pipelineStages = [
  { name: 'Sem Contato', color: '#6b7280', leads: 8, value: 42000 },
  { name: 'Em Contato', color: '#3b82f6', leads: 12, value: 87500 },
  { name: 'Negociando', color: '#f59e0b', leads: 9, value: 124000 },
  { name: 'Proposta Enviada', color: '#a855f7', leads: 6, value: 98000 },
  { name: 'Venda Realizada', color: '#22c55e', leads: 7, value: 87500 },
  { name: 'Repescagem', color: '#f97316', leads: 3, value: 28000 },
  { name: 'Perdido', color: '#ef4444', leads: 8, value: 0 },
]

const maxPipelineValue = Math.max(...pipelineStages.map(s => s.value))

function metaColor(p: number) { return p >= 80 ? '#22c55e' : p >= 50 ? '#f97316' : '#ef4444' }
function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

const thStyle: React.CSSProperties = { padding: '10px 16px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: '#e8eaf0', borderBottom: '1px solid #22283a' }
const card: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }

// ── Component ──

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month')

  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: 'Este mês' }, { key: 'quarter', label: 'Trimestre' },
    { key: 'semester', label: 'Semestre' }, { key: 'year', label: 'Ano' },
  ]

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Relatórios</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {periods.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: period === p.key ? 'rgba(249,115,22,0.12)' : '#161a22',
                border: `1px solid ${period === p.key ? '#f97316' : '#22283a'}`,
                color: period === p.key ? '#f97316' : '#6b7280', transition: 'all 0.15s',
              }}>{p.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <input type="date" style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none' }} />
            <input type="date" style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none' }} />
            <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Aplicar</button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={k.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>{k.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', display: 'block' }}>{k.value}</span>
              <span style={{ fontSize: 12, color: k.variationColor, marginTop: 4, display: 'block' }}>{k.variation}</span>
            </div>
          )
        })}
      </div>

      {/* Row 2: Performance + Loss reasons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Performance */}
        <div style={card}>
          <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Performance por vendedor</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Por receita</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead><tr style={{ background: '#0f1117' }}>
              {['Vendedor', 'Leads', 'Conv.', 'Receita', 'Meta %'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {teamPerf.map(m => (
                <tr key={m.initials}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#22283a', fontSize: 9, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.initials}</div>
                      <span>{m.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{m.leads}</td>
                  <td style={tdStyle}>{m.conv}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#22c55e' }}>{m.revenue}</td>
                  <td style={{ ...tdStyle, minWidth: 90 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, background: '#22283a', borderRadius: 2, height: 4 }}>
                        <div style={{ width: `${m.metaPct}%`, height: '100%', background: metaColor(m.metaPct), borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: metaColor(m.metaPct), fontWeight: 600, minWidth: 28 }}>{m.metaPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ background: '#0f1117' }}>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>TOTAL</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>141</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>17%</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#22c55e', borderBottom: 'none' }}>R$ 223.000</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>56%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Loss reasons */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Motivos de perda</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>8 leads perdidos</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {lossReasons.map(lr => (
              <div key={lr.reason}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#e8eaf0' }}>{lr.reason}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{lr.count} leads · {lr.pct}%</span>
                </div>
                <div style={{ background: '#22283a', borderRadius: 3, height: 6 }}>
                  <div style={{ width: `${lr.pct}%`, height: '100%', background: lr.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Activities + Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Activities */}
        <div style={card}>
          <div style={{ padding: '16px 16px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Atividades da equipe</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead><tr style={{ background: '#0f1117' }}>
              {['Vendedor', 'Ligações', 'WhatsApp', 'E-mails', 'Reuniões', 'Total'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {activities.map(a => (
                <tr key={a.initials}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#22283a', fontSize: 9, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.initials}</div>
                      <span>{a.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{a.calls}</td>
                  <td style={tdStyle}>{a.whatsapp}</td>
                  <td style={tdStyle}>{a.emails}</td>
                  <td style={tdStyle}>{a.meetings}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{a.total}</td>
                </tr>
              ))}
              <tr style={{ background: '#0f1117' }}>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>TOTAL</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>78</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>70</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>50</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>16</td>
                <td style={{ ...tdStyle, fontWeight: 700, borderBottom: 'none' }}>214</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pipeline by stage */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Pipeline por etapa</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pipelineStages.map(s => (
              <div key={s.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#e8eaf0' }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {s.leads} leads{s.value > 0 ? ` · ${fmt(s.value)}` : ''}
                  </span>
                </div>
                <div style={{ background: '#22283a', borderRadius: 3, height: 6 }}>
                  <div style={{ width: maxPipelineValue > 0 ? `${(s.value / maxPipelineValue) * 100}%` : '0%', height: '100%', background: s.color, borderRadius: 3, minWidth: s.value > 0 ? 4 : 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export row */}
      <div style={{ ...card, padding: '16px 20px', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#e8eaf0' }}>Exportar dados</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, color: '#f97316', cursor: 'pointer' }}>
            <Download size={14} strokeWidth={1.5} /> Exportar Excel
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, color: '#9ca3af', cursor: 'pointer' }}>
            <Download size={14} strokeWidth={1.5} /> Exportar CSV
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
