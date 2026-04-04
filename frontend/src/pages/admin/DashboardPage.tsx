import { useState, useEffect } from 'react'
import {
  TrendingUp, BarChart2, UserPlus, AlertCircle, AlertTriangle, Loader2,
  type LucideIcon,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import { getAdminDashboard } from '../../services/admin.service'

// ── Types ──

interface DashboardData {
  kpis: { mrr: number; arr: number; newTenantsThisMonth: number; delinquentCount: number }
  mrrHistory: { month: string; value: number }[]
  alerts: { type: string; text: string; tenantId: string }[]
  trialsExpiring: { id: string; name: string; plan: string; daysLeft: number }[]
}

// ── Helpers ──

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function formatK(v: number): string {
  if (v === 0) return '0'
  return (v / 1000).toFixed(1).replace('.', ',') + 'k'
}

// ── Component ──

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result = await getAdminDashboard()
        setData(result)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <AppLayout menuItems={adminMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando dashboard...</span>
        </div>
      </AppLayout>
    )
  }

  if (!data) {
    return (
      <AppLayout menuItems={adminMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 14, color: '#ef4444' }}>Erro ao carregar dashboard</span>
          <button onClick={() => window.location.reload()} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      </AppLayout>
    )
  }

  const { kpis, mrrHistory, alerts, trialsExpiring } = data
  const mrrMax = Math.max(...mrrHistory.map(d => d.value), 1)

  const kpiCards: { label: string; value: string; variation?: string; variationColor?: string; icon: LucideIcon; iconColor: string }[] = [
    { label: 'MRR', value: fmt(kpis.mrr), icon: TrendingUp, iconColor: '#f97316' },
    { label: 'ARR', value: fmt(kpis.arr), icon: BarChart2, iconColor: '#f97316' },
    { label: 'Novos este mês', value: String(kpis.newTenantsThisMonth), icon: UserPlus, iconColor: '#f97316' },
    { label: 'Inadimplentes', value: String(kpis.delinquentCount), variation: kpis.delinquentCount > 0 ? `⚠️ ${kpis.delinquentCount} pendente(s)` : 'Nenhum', variationColor: kpis.delinquentCount > 0 ? '#f59e0b' : '#22c55e', icon: AlertCircle, iconColor: kpis.delinquentCount > 0 ? '#ef4444' : 'var(--text-muted)' },
  ]

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Visão geral da plataforma</p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={kpi.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{kpi.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{kpi.value}</span>
              {kpi.variation && <span style={{ fontSize: 12, color: kpi.variationColor, marginTop: 4, display: 'block' }}>{kpi.variation}</span>}
            </div>
          )
        })}
      </div>

      {/* MRR Chart */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Crescimento do MRR</span>
          <span style={{ background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 999, padding: '3px 10px', fontSize: 11 }}>Últimos 6 meses</span>
        </div>
        {mrrHistory.length > 0 ? (
          <>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, padding: '0 8px' }}>
              {mrrHistory.map(d => (
                <div key={d.month} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>{formatK(d.value)}</div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, padding: '0 8px', marginTop: 6 }}>
              {mrrHistory.map(d => (
                <div key={d.month} style={{ flex: 1, height: `${(d.value / mrrMax) * 100}%`, minHeight: 8, background: 'linear-gradient(to top, #f97316, #fb923c)', borderRadius: '6px 6px 0 0' }} />
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '0 8px' }} />
            <div style={{ display: 'flex', gap: 12, marginTop: 6, padding: '0 8px' }}>
              {mrrHistory.map(d => (
                <div key={d.month} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>{d.month}</div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sem dados de MRR</div>
        )}
      </div>

      {/* Alerts + Trials row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Alerts */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Alertas</span>
            {alerts.length > 0 && <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{alerts.length}</span>}
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum alerta</div>
          ) : alerts.map((alert, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <AlertTriangle size={16} color="#ef4444" strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{alert.text}</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#ef4444', whiteSpace: 'nowrap', flexShrink: 0 }}>Crítico</span>
            </div>
          ))}
        </div>

        {/* Trials expiring */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Trials expirando</span>
            {trialsExpiring.length > 0 && <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{trialsExpiring.length}</span>}
          </div>
          {trialsExpiring.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum trial expirando</div>
          ) : trialsExpiring.map((trial, i) => {
            const ini = trial.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            const daysColor = trial.daysLeft <= 2 ? '#ef4444' : trial.daysLeft <= 3 ? '#f59e0b' : 'var(--text-secondary)'
            return (
              <div key={trial.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < trialsExpiring.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{trial.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{trial.plan}</div>
                </div>
                <span style={{ fontSize: 12, color: daysColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Expira em {trial.daysLeft} dia{trial.daysLeft !== 1 ? 's' : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
