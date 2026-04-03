import { Plus } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

// ── Data ──

const teamMembers = [
  { initials: 'PG', name: 'Pedro Gomes', meta: 20000, realized: 19600, pct: 98 },
  { initials: 'AN', name: 'Ana Souza', meta: 20000, realized: 13600, pct: 68 },
  { initials: 'LC', name: 'Lucas Castro', meta: 20000, realized: 10800, pct: 54 },
  { initials: 'MR', name: 'Mariana Reis', meta: 20000, realized: 7800, pct: 39 },
  { initials: 'TB', name: 'Thiago Bastos', meta: 20000, realized: 4200, pct: 21 },
]

const history = [
  { period: 'Mar/2026', meta: 90000, realized: 94500, pct: 105, status: 'Batida', statusColor: '#22c55e', statusBg: 'rgba(34,197,94,0.12)' },
  { period: 'Fev/2026', meta: 85000, realized: 78200, pct: 92, status: 'Quase', statusColor: '#f59e0b', statusBg: 'rgba(245,158,11,0.12)' },
  { period: 'Jan/2026', meta: 80000, realized: 71000, pct: 89, status: 'Quase', statusColor: '#f59e0b', statusBg: 'rgba(245,158,11,0.12)' },
  { period: 'Dez/2025', meta: 95000, realized: 102000, pct: 107, status: 'Batida', statusColor: '#22c55e', statusBg: 'rgba(34,197,94,0.12)' },
]

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
function barColor(p: number) { return p >= 80 ? '#22c55e' : p >= 50 ? '#f97316' : '#ef4444' }

const thS: React.CSSProperties = { padding: '12px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: '#e8eaf0', borderBottom: '1px solid #22283a' }
const card: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }

const dd: React.CSSProperties = {
  background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
  padding: '6px 28px 6px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none',
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

// ── Component ──

export default function GoalsPage() {
  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Metas</h1>
          <select style={dd}><option>Abril 2026</option><option>Março 2026</option><option>Fevereiro 2026</option></select>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Nova Meta
        </button>
      </div>

      {/* Overall progress */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e8eaf0' }}>Meta do Time — Abril 2026</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>87,5% concluído</span>
        </div>
        <div style={{ background: '#22283a', borderRadius: 999, height: 10 }}>
          <div style={{ width: '87.5%', height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 10 }}>
          <span style={{ color: '#e8eaf0' }}>R$ 87.500 realizados</span>
          <span style={{ color: '#6b7280' }}>Meta: R$ 100.000</span>
          <span style={{ color: '#f59e0b' }}>Faltam R$ 12.500</span>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>27 dias restantes no período</div>
      </div>

      {/* 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        {/* Left — Individual goals */}
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Meta individual</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Por receita</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f1117' }}>
                {['Vendedor', 'Meta', 'Realizado', '%', ''].map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(m => (
                <tr key={m.initials} style={{ cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1c2130' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <td style={tdS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', fontSize: 10, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.initials}</div>
                      <span>{m.name}</span>
                    </div>
                  </td>
                  <td style={tdS}>{fmt(m.meta)}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: '#22c55e' }}>{fmt(m.realized)}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: barColor(m.pct) }}>{m.pct}%</td>
                  <td style={{ ...tdS, width: 100 }}>
                    <div style={{ background: '#22283a', borderRadius: 3, height: 6 }}>
                      <div style={{ width: `${Math.min(m.pct, 100)}%`, height: '100%', background: barColor(m.pct), borderRadius: 3 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right — Configuration */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Configuração da meta</div>

          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Meta atual</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <ConfigRow label="Tipo" value="Receita + Nº de vendas" />
            <ConfigRow label="Período" value="Mensal — Abril 2026" />
            <ConfigRow label="Distribuição" value="Por operador (igual)" />
            <ConfigRow label="Meta receita" value="R$ 100.000" valueColor="#f97316" />
            <ConfigRow label="Meta vendas" value="25 fechamentos" />
          </div>
          <button style={{ width: '100%', background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Editar configuração
          </button>

          <div style={{ height: 1, background: '#22283a', margin: '20px 0' }} />

          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Novos vendedores em rampagem</div>
          <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>Nenhum vendedor em rampagem</div>
            <button style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
              + Configurar rampagem
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div style={{ ...card, marginTop: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Histórico de metas</span>
          <span style={{ fontSize: 12, color: '#f97316', cursor: 'pointer' }}>Ver todos →</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f1117' }}>
              {['Período', 'Meta', 'Realizado', '%', 'Status'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.period} style={{ borderBottom: '1px solid #22283a' }}>
                <td style={tdS}>{h.period}</td>
                <td style={tdS}>{fmt(h.meta)}</td>
                <td style={{ ...tdS, fontWeight: 700, color: '#22c55e' }}>{fmt(h.realized)}</td>
                <td style={{ ...tdS, fontWeight: 700, color: h.pct >= 100 ? '#22c55e' : '#f59e0b' }}>{h.pct}%</td>
                <td style={tdS}>
                  <span style={{ background: h.statusBg, color: h.statusColor, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{h.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
