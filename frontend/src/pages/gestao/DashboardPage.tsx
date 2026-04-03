import { TrendingUp, Target, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Kanban } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

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

// ── KPI Data ──

const kpis = [
  { label: 'Receita no Mês', value: 'R$ 87.500', variation: '↑ 87,5% da meta', variationColor: '#22c55e', icon: TrendingUp, iconColor: '#f97316' },
  { label: 'Pipeline Total', value: 'R$ 340.000', variation: '↑ +8% vs mês ant.', variationColor: '#22c55e', icon: Kanban, iconColor: '#f97316' },
  { label: 'Taxa de Conversão', value: '22,5%', variation: '↑ +1,2pp vs mês ant.', variationColor: '#22c55e', icon: Target, iconColor: '#f97316' },
  { label: 'Aprovações pendentes', value: '3', variation: '⚠️ Requer ação', variationColor: '#f59e0b', icon: Clock, iconColor: '#f59e0b' },
]

// ── Team Data ──

const teamMembers = [
  { initials: 'PG', name: 'Pedro Gomes', team: 'Time Sul', leads: 38, deals: 9, conversion: '23%', revenue: 'R$ 78.000', metaPct: 98 },
  { initials: 'AN', name: 'Ana Souza', team: 'Time Sul', leads: 32, deals: 6, conversion: '18%', revenue: 'R$ 54.000', metaPct: 68 },
  { initials: 'LC', name: 'Lucas Castro', team: 'Time Norte', leads: 29, deals: 5, conversion: '17%', revenue: 'R$ 43.000', metaPct: 54 },
  { initials: 'MR', name: 'Mariana Reis', team: 'Time Norte', leads: 24, deals: 4, conversion: '16%', revenue: 'R$ 31.000', metaPct: 39 },
  { initials: 'TB', name: 'Thiago Bastos', team: 'Time Sul', leads: 18, deals: 2, conversion: '11%', revenue: 'R$ 17.000', metaPct: 21 },
]

function metaColor(pct: number): string {
  if (pct >= 80) return '#22c55e'
  if (pct >= 50) return '#f97316'
  return '#ef4444'
}

// ── Approvals Data ──

const approvals = [
  { discount: 'Desconto 12% — Plano Pro', from: 'Ana Souza → Camila Torres', time: 'há 2h' },
  { discount: 'Desconto 8% — Essencial', from: 'Lucas Castro → Rafael Mendes', time: 'há 5h' },
  { discount: 'Desconto 15% — Enterprise', from: 'Pedro Gomes → GomesTech', time: 'ontem' },
]

// ── Stale Leads Data ──

const staleLeads = [
  { initials: 'TB', name: 'Thiago Bastos', detail: 'Bastos & Co · Negociando', days: 7, color: '#ef4444' },
  { initials: 'FL', name: 'Fernanda Lima', detail: 'Lima Dist. · Sem Contato', days: 6, color: '#ef4444' },
  { initials: 'PH', name: 'Paulo Henrique', detail: 'PH Soluções · Em Contato', days: 5, color: '#f59e0b' },
  { initials: 'BS', name: 'Bruno Salave', detail: 'SalaGroup · Repescagem', days: 5, color: '#f59e0b' },
]

// ── Component ──

export default function GestaoDashboardPage() {
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
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Meta de Abril — Receita</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>87,5% concluído</span>
        </div>
        <div style={{ background: '#22283a', borderRadius: 999, height: 8, margin: '12px 0' }}>
          <div style={{ width: '87.5%', height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: '#e8eaf0' }}>R$ 87.500 realizados</span>
          <span style={{ color: '#6b7280' }}>Meta: R$ 100.000</span>
          <span style={{ color: '#f59e0b' }}>Faltam R$ 12.500</span>
        </div>
      </div>

      {/* Team Performance Table */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, marginTop: 20, overflow: 'hidden' }}>
        {/* Table header bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Performance da equipe</span>
            <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>2 abaixo da meta</span>
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Por receita · Abril 2026</span>
        </div>
        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f1117' }}>
              {['Vendedor', 'Leads', 'Fechamentos', 'Conversão', 'Receita', 'Meta %'].map((h) => (
                <th key={h} style={{ padding: '10px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((m) => (
              <tr key={m.initials} style={{ borderBottom: '1px solid #22283a' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', fontSize: 10, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {m.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{m.team}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{m.leads}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{m.deals}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{m.conversion}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500, color: '#22c55e' }}>{m.revenue}</td>
                <td style={{ padding: '14px 20px', minWidth: 100 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, background: '#22283a', borderRadius: 2, height: 4 }}>
                      <div style={{ width: `${m.metaPct}%`, height: '100%', background: metaColor(m.metaPct), borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: metaColor(m.metaPct), fontWeight: 600, minWidth: 28 }}>{m.metaPct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approvals + Stale Leads row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Approvals */}
        <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Aprovações pendentes</span>
            <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>3</span>
          </div>
          {approvals.map((a, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: i < approvals.length - 1 ? '1px solid #22283a' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{a.discount}</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{a.time}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{a.from}</div>
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
            <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>5d+</span>
          </div>
          {staleLeads.map((lead, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < staleLeads.length - 1 ? '1px solid #22283a' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', fontSize: 10, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {lead.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{lead.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{lead.detail}</div>
              </div>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0,
                background: lead.days >= 6 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                color: lead.color,
              }}>
                {lead.days}d
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
