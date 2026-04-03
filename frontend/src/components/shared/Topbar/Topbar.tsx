import { Bell } from 'lucide-react'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default function Topbar() {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string }
  const initials = getInitials(user.name ?? 'U')

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
        justifyContent: 'flex-end',
        padding: '0 24px',
        zIndex: 40,
      }}
    >
      {/* Right — Bell + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={18} color="#9ca3af" strokeWidth={1.5} />
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
            3
          </span>
        </div>

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
