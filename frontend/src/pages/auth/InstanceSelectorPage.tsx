import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings2, BarChart2 } from 'lucide-react'

interface CardData {
  icon: typeof Settings2
  title: string
  subtitle: string
  path: string
}

export default function InstanceSelectorPage() {
  const navigate = useNavigate()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { tenantId?: string }
  const tenantName = 'Tribo de Vendas'

  const cards: CardData[] = [
    {
      icon: Settings2,
      title: 'Super Admin',
      subtitle: 'Painel interno da plataforma',
      path: '/admin/dashboard',
    },
    {
      icon: BarChart2,
      title: 'Gestor',
      subtitle: tenantName,
      path: '/gestao/dashboard',
    },
  ]

  // Redirect if no token
  if (!user.tenantId && !localStorage.getItem('accessToken')) {
    navigate('/login')
    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 16,
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
          <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
          <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
        </h1>
      </div>

      {/* Subtitle */}
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 40, marginTop: 0 }}>
        Como deseja entrar?
      </p>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 20 }}>
        {cards.map((card, index) => {
          const Icon = card.icon
          const isHovered = hoveredIndex === index
          return (
            <div
              key={card.path}
              onClick={() => navigate(card.path)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                background: isHovered ? 'var(--bg-elevated)' : 'var(--bg-card)',
                border: `1px solid ${isHovered ? '#f97316' : 'var(--border)'}`,
                borderRadius: 16,
                padding: '32px 40px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                minWidth: 200,
              }}
            >
              <Icon size={32} color="#f97316" strokeWidth={1.5} style={{ marginBottom: 16 }} />
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{card.title}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{card.subtitle}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
