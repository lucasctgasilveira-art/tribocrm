import { useState } from 'react'
import { TrendingUp, BarChart2, AlertCircle, UserMinus, DollarSign, Download } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

type Period = 'month' | 'quarter' | 'year'

const kpis = [
  { label: 'MRR', value: 'R$ 42.180', variation: '↑ +12% vs mês ant.', vColor: '#22c55e', icon: TrendingUp, iColor: '#f97316' },
  { label: 'ARR', value: 'R$ 506.160', variation: '↑ projetado', vColor: '#22c55e', icon: BarChart2, iColor: '#f97316' },
  { label: 'Inadimplentes', value: '4', variation: '⚠️ 2 críticos', vColor: '#f59e0b', icon: AlertCircle, iColor: '#ef4444' },
  { label: 'Churn', value: '2', variation: '↓ -1 vs mês ant.', vColor: '#22c55e', icon: UserMinus, iColor: '#6b7280' },
  { label: 'Ticket Médio', value: 'R$ 296', variation: '↑ +5% vs mês ant.', vColor: '#22c55e', icon: DollarSign, iColor: '#f97316' },
]

interface Charge { company: string; plan: string; planColor: string; planBg: string; value: string; due: string; paid: string; status: 'Pago' | 'Pendente' | 'Vencido' | 'Cancelado' }

const charges: Charge[] = [
  { company: 'MendesNet', plan: 'Pro', planColor: '#f97316', planBg: 'rgba(249,115,22,0.12)', value: 'R$ 349', due: '05/04/2026', paid: '05/04/2026', status: 'Pago' },
  { company: 'GomesTech', plan: 'Enterprise', planColor: '#a855f7', planBg: 'rgba(168,85,247,0.12)', value: 'R$ 649', due: '10/04/2026', paid: '—', status: 'Pendente' },
  { company: 'Torres & Filhos', plan: 'Essencial', planColor: '#3b82f6', planBg: 'rgba(59,130,246,0.12)', value: 'R$ 197', due: '01/04/2026', paid: '—', status: 'Vencido' },
  { company: 'Lima Distribuidora', plan: 'Essencial', planColor: '#3b82f6', planBg: 'rgba(59,130,246,0.12)', value: 'R$ 197', due: '18/04/2026', paid: '18/03/2026', status: 'Pago' },
  { company: 'Souza Commerce', plan: 'Pro', planColor: '#f97316', planBg: 'rgba(249,115,22,0.12)', value: 'R$ 349', due: '01/04/2026', paid: '—', status: 'Vencido' },
  { company: 'Ribeiro Vendas', plan: 'Solo', planColor: '#9ca3af', planBg: 'rgba(107,114,128,0.12)', value: 'R$ 69', due: '22/04/2026', paid: '—', status: 'Pendente' },
  { company: 'Alpha Marketing', plan: 'Pro', planColor: '#f97316', planBg: 'rgba(249,115,22,0.12)', value: 'R$ 349', due: '08/04/2026', paid: '07/04/2026', status: 'Pago' },
  { company: 'Prime Solutions', plan: 'Enterprise', planColor: '#a855f7', planBg: 'rgba(168,85,247,0.12)', value: 'R$ 649', due: '30/04/2026', paid: '—', status: 'Pendente' },
  { company: 'Bastos & Co', plan: 'Solo', planColor: '#9ca3af', planBg: 'rgba(107,114,128,0.12)', value: 'R$ 69', due: '21/03/2026', paid: '—', status: 'Vencido' },
  { company: 'Costa Digital', plan: 'Essencial', planColor: '#3b82f6', planBg: 'rgba(59,130,246,0.12)', value: 'R$ 197', due: '15/03/2026', paid: '—', status: 'Cancelado' },
]

const statusS: Record<string, { bg: string; color: string }> = { Pago: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' }, Pendente: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' }, Vencido: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' }, Cancelado: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' } }
const thS: React.CSSProperties = { padding: '12px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: '#e8eaf0', borderBottom: '1px solid #22283a' }

export default function FinancialPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [toast, setToast] = useState('')
  const periods: { key: Period; label: string }[] = [{ key: 'month', label: 'Este mês' }, { key: 'quarter', label: 'Trimestre' }, { key: 'year', label: 'Ano' }]

  return (
    <AppLayout menuItems={adminMenuItems}>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: '#161a22', border: '1px solid #22283a', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#e8eaf0', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Financeiro</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {periods.map(p => <button key={p.key} onClick={() => setPeriod(p.key)} style={{ borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: period === p.key ? 'rgba(249,115,22,0.12)' : '#161a22', border: `1px solid ${period === p.key ? '#f97316' : '#22283a'}`, color: period === p.key ? '#f97316' : '#6b7280' }}>{p.label}</button>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        {kpis.map(k => { const I = k.icon; return (
          <div key={k.label} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 16, position: 'relative' }}>
            <I size={18} color={k.iColor} strokeWidth={1.5} style={{ position: 'absolute', top: 16, right: 16 }} />
            <span style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>{k.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', display: 'block' }}>{k.value}</span>
            <span style={{ fontSize: 11, color: k.vColor, marginTop: 2, display: 'block' }}>{k.variation}</span>
          </div>
        )})}
      </div>

      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Cobranças</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: '5px 24px 5px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none', cursor: 'pointer', appearance: 'none' as const }}><option>Status</option><option>Pago</option><option>Pendente</option><option>Vencido</option><option>Cancelado</option></select>
            <select style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: '5px 24px 5px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none', cursor: 'pointer', appearance: 'none' as const }}><option>Plano</option><option>Solo</option><option>Essencial</option><option>Pro</option><option>Enterprise</option></select>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}><Download size={12} strokeWidth={1.5} /> Exportar CSV</button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#0f1117' }}>{['Empresa', 'Plano', 'Valor', 'Vencimento', 'Pagamento', 'Status', 'Ações'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {charges.map((c, i) => { const s = statusS[c.status]!; return (
              <tr key={i} onMouseEnter={e => { e.currentTarget.style.background = '#1c2130' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={tdS}>{c.company}</td>
                <td style={tdS}><span style={{ background: c.planBg, color: c.planColor, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{c.plan}</span></td>
                <td style={{ ...tdS, fontWeight: 700 }}>{c.value}</td>
                <td style={tdS}>{c.due}</td>
                <td style={tdS}>{c.paid}</td>
                <td style={tdS}><span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{c.status}</span></td>
                <td style={tdS}>
                  <button onClick={() => { if (c.status !== 'Pago' && c.status !== 'Cancelado') { setToast(`Cobrança enviada para ${c.company}!`); setTimeout(() => setToast(''), 3000) } }}
                    style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: c.status === 'Pago' || c.status === 'Cancelado' ? '#9ca3af' : '#f97316', cursor: 'pointer' }}>
                    {c.status === 'Pago' || c.status === 'Cancelado' ? 'Ver' : 'Cobrar'}
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #22283a', fontSize: 12, color: '#6b7280' }}>Mostrando 1-10 de 174 cobranças</div>
      </div>
    </AppLayout>
  )
}
