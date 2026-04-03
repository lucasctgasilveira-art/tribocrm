import { Shuffle } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { Plus } from 'lucide-react'

interface Team {
  name: string; color: string; bg: string; leaderInitials: string; leaderName: string
  members: string[]; memberCount: number; leads: number; value: string; conv: string
}

const teams: Team[] = [
  { name: 'Time Sul', color: '#f97316', bg: 'rgba(249,115,22,0.12)', leaderInitials: 'MR', leaderName: 'Mariana Reis', members: ['AS', 'PG', 'TB'], memberCount: 3, leads: 88, value: 'R$ 149.000', conv: '19%' },
  { name: 'Time Norte', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', leaderInitials: 'LC', leaderName: 'Lucas Castro', members: ['MR'], memberCount: 2, leads: 53, value: 'R$ 74.000', conv: '17%' },
]

export default function TeamsPage() {
  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Times</h1>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Time
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {teams.map(t => (
          <div key={t.name} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ background: t.bg, color: t.color, borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>{t.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
                <button style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>···</button>
              </div>
            </div>

            {/* Leader */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Líder</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.leaderInitials}</div>
                <span style={{ fontSize: 13, color: '#e8eaf0', fontWeight: 500 }}>{t.leaderName}</span>
                <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>Líder</span>
              </div>
            </div>

            {/* Members */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Membros</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {t.members.map((m, i) => (
                  <div key={m} style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', color: '#e8eaf0', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #161a22', marginLeft: i > 0 ? -8 : 0, zIndex: t.members.length - i }}>{m}</div>
                ))}
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{t.memberCount} membros</span>
              </div>
            </div>

            {/* Separator */}
            <div style={{ height: 1, background: '#22283a', margin: '0 0 16px' }} />

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: '#e8eaf0', fontWeight: 700 }}>{t.leads} leads</span>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{t.value}</span>
              <span style={{ color: '#9ca3af' }}>Conv. {t.conv}</span>
            </div>

            {/* Distribution */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
              <Shuffle size={14} strokeWidth={1.5} />
              <span>Round-robin automático</span>
            </div>

            {/* Action */}
            <button style={{ width: '100%', background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 0', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Gerenciar membros</button>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
