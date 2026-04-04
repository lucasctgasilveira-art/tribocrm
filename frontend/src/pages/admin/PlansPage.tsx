import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

interface Plan {
  name: string
  color: string
  bg: string
  active: boolean
  popular?: boolean
  price: string
  cycle: string
  limits: string[]
  customers: string
  highlight?: boolean
}

const plans: Plan[] = [
  {
    name: 'Gratuito',
    color: 'var(--text-muted)',
    bg: 'rgba(107,114,128,0.12)',
    active: true,
    price: 'R$ 0',
    cycle: '30 dias',
    limits: ['1 usuário', '50 leads', '1 pipeline'],
    customers: '28 em trial',
  },
  {
    name: 'Solo',
    color: 'var(--text-muted)',
    bg: 'rgba(107,114,128,0.12)',
    active: true,
    price: 'R$ 69',
    cycle: '/mês',
    limits: ['1 usuário', '1.000 leads', '1 pipeline', '3 modelos WPP'],
    customers: '18 ativos',
  },
  {
    name: 'Essencial',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    active: true,
    price: 'R$ 197',
    cycle: '/mês',
    limits: ['3 usuários', '5.000 leads', '3 pipelines'],
    customers: '54 ativos',
  },
  {
    name: 'Pro',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    active: true,
    popular: true,
    price: 'R$ 349',
    cycle: '/mês',
    limits: ['5 usuários', '10.000 leads', '10 pipelines', '10 automações'],
    customers: '52 ativos',
    highlight: true,
  },
  {
    name: 'Enterprise',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.12)',
    active: true,
    price: 'R$ 649',
    cycle: '/mês',
    limits: ['10 usuários', '50.000 leads', 'ilimitado pipelines', 'automações ilimitadas'],
    customers: '18 ativos',
  },
]

const stats = [
  { label: 'Total', value: '5' },
  { label: 'Ativos', value: '4' },
  { label: 'MRR médio', value: 'R$ 296' },
  { label: 'Clientes ativos', value: '142' },
]

export default function PlansPage() {
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  return (
    <AppLayout menuItems={adminMenuItems}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Planos</h1>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#f97316',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 8,
            padding: '8px 16px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Novo Plano
        </button>
      </div>

      {/* stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 20px',
              flex: 1,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              {s.label}
            </span>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {plans.map((p) => (
          <div
            key={p.name}
            style={{
              background: 'var(--bg-card)',
              border: p.highlight ? '2px solid #f97316' : '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              position: 'relative',
            }}
          >
            {/* badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: p.color,
                  background: p.bg,
                  borderRadius: 6,
                  padding: '3px 10px',
                }}
              >
                {p.name}
              </span>
              {p.active && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#22c55e',
                    background: 'rgba(34,197,94,0.12)',
                    borderRadius: 6,
                    padding: '3px 8px',
                  }}
                >
                  Ativo
                </span>
              )}
              {p.popular && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#f97316',
                    background: 'rgba(249,115,22,0.12)',
                    borderRadius: 6,
                    padding: '2px 8px',
                  }}
                >
                  Mais popular
                </span>
              )}
            </div>

            {/* price */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{p.price}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>{p.cycle}</span>
            </div>

            {/* limits */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {p.limits.map((l) => (
                <span
                  key={l}
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {l}
                </span>
              ))}
            </div>

            {/* customers */}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>{p.customers}</p>

            {/* actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  background: 'var(--border)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Editar limites
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(menuOpen === p.name ? null : p.name)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <MoreHorizontal size={16} color="var(--text-muted)" />
                </button>
                {menuOpen === p.name && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 4,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 4,
                      minWidth: 140,
                      zIndex: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    {['Editar plano', 'Duplicar', 'Desativar'].map((action) => (
                      <button
                        key={action}
                        onClick={() => setMenuOpen(null)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          padding: '8px 12px',
                          fontSize: 13,
                          color: action === 'Desativar' ? '#ef4444' : 'var(--text-primary)',
                          cursor: 'pointer',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
