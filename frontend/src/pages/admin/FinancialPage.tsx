import { useState, useEffect } from 'react'
import { TrendingUp, BarChart2, AlertCircle, UserMinus, DollarSign, Download, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import { getFinancial } from '../../services/admin.service'

// ── Types ──

type Period = 'month' | 'quarter' | 'year'

interface Charge {
  id: string
  amount: string | number
  dueDate: string
  paidAt: string | null
  status: string
  tenant: { id: string; name: string; plan: { id: string; name: string; slug: string } }
}

interface FinancialData {
  kpis: { mrr: number; arr: number; overdueCount: number; churnRate: number; averageTicket: number }
  charges: Charge[]
}

// ── Config ──

const statusS: Record<string, { bg: string; color: string; label: string }> = {
  PAID: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Pago' },
  PENDING: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Pendente' },
  OVERDUE: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Vencido' },
  CANCELLED: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', label: 'Cancelado' },
}

const planColors: Record<string, { bg: string; color: string }> = {
  solo: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-secondary)' },
  essencial: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  pro: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  enterprise: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

const thS: React.CSSProperties = { padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }

// ── Component ──

export default function FinancialPage() {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result = await getFinancial({ period })
        setData(result)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period])

  const periods: { key: Period; label: string }[] = [{ key: 'month', label: 'Este mês' }, { key: 'quarter', label: 'Trimestre' }, { key: 'year', label: 'Ano' }]

  if (loading) {
    return (
      <AppLayout menuItems={adminMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando financeiro...</span>
        </div>
      </AppLayout>
    )
  }

  const kpis = data?.kpis ?? { mrr: 0, arr: 0, overdueCount: 0, churnRate: 0, averageTicket: 0 }
  const charges = data?.charges ?? []

  const kpiCards = [
    { label: 'MRR', value: fmt(kpis.mrr), variation: '', vColor: '#22c55e', icon: TrendingUp, iColor: '#f97316' },
    { label: 'ARR', value: fmt(kpis.arr), variation: '', vColor: '#22c55e', icon: BarChart2, iColor: '#f97316' },
    { label: 'Inadimplentes', value: String(kpis.overdueCount), variation: kpis.overdueCount > 0 ? `⚠️ ${kpis.overdueCount} pendente(s)` : '', vColor: '#f59e0b', icon: AlertCircle, iColor: '#ef4444' },
    { label: 'Churn', value: `${kpis.churnRate}%`, variation: '', vColor: '#22c55e', icon: UserMinus, iColor: 'var(--text-muted)' },
    { label: 'Ticket Médio', value: fmt(kpis.averageTicket), variation: '', vColor: '#22c55e', icon: DollarSign, iColor: '#f97316' },
  ]

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Financeiro</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: period === p.key ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
              border: `1px solid ${period === p.key ? '#f97316' : 'var(--border)'}`,
              color: period === p.key ? '#f97316' : 'var(--text-muted)',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        {kpiCards.map(k => {
          const I = k.icon
          return (
            <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'relative' }}>
              <I size={18} color={k.iColor} strokeWidth={1.5} style={{ position: 'absolute', top: 16, right: 16 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{k.label}</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{k.value}</span>
              {k.variation && <span style={{ fontSize: 11, color: k.vColor, marginTop: 2, display: 'block' }}>{k.variation}</span>}
            </div>
          )
        })}
      </div>

      {/* Charges table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Cobranças</span>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Download size={12} strokeWidth={1.5} /> Exportar CSV
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Empresa', 'Plano', 'Valor', 'Vencimento', 'Pagamento', 'Status', 'Ações'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Nenhuma cobrança encontrada</td></tr>
            ) : charges.map(c => {
              const s = statusS[c.status] ?? statusS.PENDING!
              const pc = planColors[c.tenant.plan.slug] ?? planColors.solo
              return (
                <tr key={c.id} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <td style={tdS}>{c.tenant.name}</td>
                  <td style={tdS}><span style={{ background: pc!.bg, color: pc!.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{c.tenant.plan.name}</span></td>
                  <td style={{ ...tdS, fontWeight: 700 }}>{fmt(Number(c.amount))}</td>
                  <td style={tdS}>{new Date(c.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td style={tdS}>{c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={tdS}><span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{s.label}</span></td>
                  <td style={tdS}>
                    {c.status === 'OVERDUE' || c.status === 'PENDING' ? (
                      <button style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Cobrar agora</button>
                    ) : c.status === 'PAID' ? (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
          Mostrando {charges.length} cobrança{charges.length !== 1 ? 's' : ''}
        </div>
      </div>
    </AppLayout>
  )
}
