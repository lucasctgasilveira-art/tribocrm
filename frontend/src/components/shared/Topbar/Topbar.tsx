import { useState, useEffect, useRef } from 'react'
import {
  Bell, Search, Mail, ShieldCheck, AlertCircle, CheckCircle2, UserPlus,
  type LucideIcon,
} from 'lucide-react'

/* ── types ── */

interface Notification {
  id: string
  icon: LucideIcon
  iconColor: string
  title: string
  subtitle: string
  time: string
  read: boolean
}

const initialNotifications: Notification[] = [
  { id: 'n1', icon: Mail, iconColor: '#3b82f6', title: 'Camila Torres abriu seu e-mail', subtitle: 'Proposta comercial — aberto 3x', time: 'há 5 minutos', read: false },
  { id: 'n2', icon: ShieldCheck, iconColor: '#22c55e', title: 'Desconto aprovado', subtitle: 'Ana Souza aprovou 15% para GomesTech', time: 'há 20 minutos', read: false },
  { id: 'n3', icon: AlertCircle, iconColor: '#f59e0b', title: 'Lead quente sem contato', subtitle: 'Roberto Souza — sem atividade há 2 dias', time: 'há 1 hora', read: false },
  { id: 'n4', icon: CheckCircle2, iconColor: '#22c55e', title: 'Venda fechada — Torres & Filhos', subtitle: 'R$ 12.000 fechado por Ana Souza', time: 'há 3 horas', read: true },
  { id: 'n5', icon: UserPlus, iconColor: '#f97316', title: 'Novo lead captado', subtitle: 'Formulário do site — Fernanda Lima', time: 'há 5 horas', read: true },
]

/* ── helpers ── */

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/* ── component ── */

interface TopbarProps {
  onOpenSearch?: () => void
}

export default function Topbar({ onOpenSearch }: TopbarProps) {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string }
  const initials = getInitials(user.name ?? 'U')

  const [showNotif, setShowNotif] = useState(false)
  const [notifications, setNotifications] = useState(initialNotifications)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  /* close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    if (showNotif) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotif])

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        background: '#111318',
        borderBottom: '1px solid #22283a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        zIndex: 40,
      }}
    >
      {/* Center — search bar */}
      <div
        onClick={onOpenSearch}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 240,
          background: '#111318',
          border: '1px solid #22283a',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <Search size={16} color="#6b7280" />
        <span style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>Buscar...</span>
        <span
          style={{
            background: '#22283a',
            color: '#6b7280',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          Ctrl+K
        </span>
      </div>

      {/* Right — Bell + Avatar */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Bell */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setShowNotif(!showNotif)}
            style={{ position: 'relative', cursor: 'pointer' }}
          >
            <Bell size={18} color="#9ca3af" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>

          {/* dropdown */}
          {showNotif && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 360,
                background: '#161a22',
                border: '1px solid #22283a',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              {/* header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderBottom: '1px solid #22283a',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Notificações</span>
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f97316',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Marcar todas como lidas
                </button>
              </div>

              {/* list */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.map((n) => {
                  const Icon = n.icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #22283a',
                        display: 'flex',
                        gap: 10,
                        cursor: 'pointer',
                        background: n.read ? 'transparent' : 'rgba(249,115,22,0.04)',
                        borderLeft: n.read ? 'none' : '2px solid #f97316',
                        opacity: n.read ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = n.read ? 'rgba(255,255,255,0.03)' : 'rgba(249,115,22,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(249,115,22,0.04)')}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: `${n.iconColor}1F`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={16} color={n.iconColor} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{n.subtitle}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{n.time}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* footer */}
              <div
                style={{
                  padding: 12,
                  borderTop: '1px solid #22283a',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 13, color: '#f97316' }}>Ver todas as notificações →</span>
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#f97316',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
