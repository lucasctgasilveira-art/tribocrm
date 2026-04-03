import {
  TrendingUp, BarChart2, UserPlus, AlertCircle, Clock, AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

// ── KPI Data ──

interface KpiCard {
  label: string
  value: string
  variation: string
  variationColor: string
  icon: LucideIcon
  iconColor: string
}

const kpis: KpiCard[] = [
  { label: 'MRR', value: 'R$ 42.180', variation: '↑ +12% vs mês ant.', variationColor: '#22c55e', icon: TrendingUp, iconColor: '#f97316' },
  { label: 'ARR', value: 'R$ 506.160', variation: '↑ +12% projetado', variationColor: '#22c55e', icon: BarChart2, iconColor: '#f97316' },
  { label: 'Novos este mês', value: '12', variation: '↑ +3 vs mês ant.', variationColor: '#22c55e', icon: UserPlus, iconColor: '#f97316' },
  { label: 'Inadimplentes', value: '4', variation: '⚠️ 2 críticos', variationColor: '#f59e0b', icon: AlertCircle, iconColor: '#ef4444' },
]

// ── MRR Chart Data ──

const mrrData = [
  { month: 'Out/25', value: 28400 },
  { month: 'Nov/25', value: 31200 },
  { month: 'Dez/25', value: 33800 },
  { month: 'Jan/26', value: 36100 },
  { month: 'Fev/26', value: 38900 },
  { month: 'Mar/26', value: 42180 },
]

const mrrMax = Math.max(...mrrData.map((d) => d.value))

function formatK(v: number): string {
  return (v / 1000).toFixed(1).replace('.', ',') + 'k'
}

// ── Alerts Data ──

interface AlertItem {
  icon: LucideIcon
  iconColor: string
  text: string
  badge: string
  badgeBg: string
  badgeColor: string
}

const alerts: AlertItem[] = [
  { icon: AlertCircle, iconColor: '#ef4444', text: '4 clientes com pagamento vencido', badge: 'Crítico', badgeBg: 'rgba(239,68,68,0.12)', badgeColor: '#ef4444' },
  { icon: Clock, iconColor: '#f59e0b', text: '3 trials expiram em menos de 3 dias', badge: 'Atenção', badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#f59e0b' },
  { icon: AlertTriangle, iconColor: '#f59e0b', text: 'Webhook do Banco Efi com falha às 14:32', badge: 'Sistema', badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#f59e0b' },
]

// ── Trials Data ──

interface TrialItem {
  initials: string
  name: string
  plan: string
  daysLeft: number
  daysColor: string
}

const trials: TrialItem[] = [
  { initials: 'TF', name: 'Torres & Filhos', plan: 'Plano Essencial', daysLeft: 2, daysColor: '#ef4444' },
  { initials: 'MN', name: 'MendesNet', plan: 'Plano Pro', daysLeft: 3, daysColor: '#f59e0b' },
  { initials: 'SC', name: 'Souza Commerce', plan: 'Plano Solo', daysLeft: 5, daysColor: '#9ca3af' },
]

// ── Component ──

export default function AdminDashboardPage() {
  return (
    <AppLayout menuItems={adminMenuItems}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Visão geral da plataforma</p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              style={{
                background: '#161a22', border: '1px solid #22283a', borderRadius: 12,
                padding: 20, position: 'relative',
              }}
            >
              <Icon size={20} color={kpi.iconColor} strokeWidth={1.5}
                style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                {kpi.label}
              </span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', display: 'block' }}>
                {kpi.value}
              </span>
              <span style={{ fontSize: 12, color: kpi.variationColor, marginTop: 4, display: 'block' }}>
                {kpi.variation}
              </span>
            </div>
          )
        })}
      </div>

      {/* MRR Chart */}
      <div
        style={{
          background: '#161a22', border: '1px solid #22283a', borderRadius: 12,
          padding: 20, marginTop: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Crescimento do MRR</span>
          <span style={{
            background: '#22283a', color: '#9ca3af', borderRadius: 999,
            padding: '3px 10px', fontSize: 11,
          }}>
            Últimos 6 meses
          </span>
        </div>

        {/* Bar values */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, padding: '0 8px' }}>
          {mrrData.map((d) => (
            <div key={d.month} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
              {formatK(d.value)}
            </div>
          ))}
        </div>
        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, padding: '0 8px', marginTop: 6 }}>
          {mrrData.map((d) => {
            const heightPct = (d.value / mrrMax) * 100
            return (
              <div
                key={d.month}
                style={{
                  flex: 1, height: `${heightPct}%`, minHeight: 8,
                  background: 'linear-gradient(to top, #f97316, #fb923c)',
                  borderRadius: '6px 6px 0 0',
                }}
              />
            )
          })}
        </div>
        {/* Baseline */}
        <div style={{ borderTop: '1px solid #22283a', margin: '0 8px' }} />
        {/* Month labels */}
        <div style={{ display: 'flex', gap: 12, marginTop: 6, padding: '0 8px' }}>
          {mrrData.map((d) => (
            <div key={d.month} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#6b7280' }}>
              {d.month}
            </div>
          ))}
        </div>
      </div>

      {/* Alerts + Trials row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Alerts */}
        <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Alertas</span>
            <span style={{
              background: 'rgba(239,68,68,0.12)', color: '#ef4444',
              borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700,
            }}>3</span>
          </div>
          {alerts.map((alert, i) => {
            const Icon = alert.icon
            return (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '12px 0',
                  borderBottom: i < alerts.length - 1 ? '1px solid #22283a' : 'none',
                }}
              >
                <Icon size={16} color={alert.iconColor} strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#e8eaf0', flex: 1 }}>{alert.text}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                  background: alert.badgeBg, color: alert.badgeColor, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {alert.badge}
                </span>
              </div>
            )
          })}
        </div>

        {/* Trials expiring */}
        <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Trials expirando</span>
            <span style={{
              background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
              borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700,
            }}>3</span>
          </div>
          {trials.map((trial, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 12, alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < trials.length - 1 ? '1px solid #22283a' : 'none',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#22283a',
                fontSize: 11, fontWeight: 700, color: '#e8eaf0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {trial.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{trial.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{trial.plan}</div>
              </div>
              <span style={{ fontSize: 12, color: trial.daysColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Expira em {trial.daysLeft} dias
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
