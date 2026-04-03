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
        background: '#0a0b0f',
        padding: 16,
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
          <span style={{ fontWeight: 400, color: '#e8eaf0' }}>Tribo</span>
          <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
        </h1>
      </div>

      {/* Subtitle */}
      <p style={{ fontSize: 16, color: '#9ca3af', marginBottom: 40, marginTop: 0 }}>
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
                background: isHovered ? '#1c2130' : '#161a22',
                border: `1px solid ${isHovered ? '#f97316' : '#22283a'}`,
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
              <span style={{ fontSize: 17, fontWeight: 700, color: '#e8eaf0' }}>{card.title}</span>
              <span style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>{card.subtitle}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
