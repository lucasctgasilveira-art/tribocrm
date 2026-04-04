import { useState, useEffect } from 'react'
import { Shuffle, Plus, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getTeams } from '../../services/users.service'

// ── Types ──

interface TeamMemberUser { id: string; name: string; role: string }
interface TeamMember { id: string; userId: string; user: TeamMemberUser }
interface TeamLeader { id: string; name: string }

interface Team {
  id: string
  name: string
  leader: TeamLeader | null
  members: TeamMember[]
  createdAt: string
}

// ── Helpers ──

function ini(n: string): string {
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const teamColors = [
  { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
]

// ── Component ──

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getTeams()
        setTeams(data)
      } catch {
        setTeams([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Times</h1>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Time
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: '#6b7280' }}>Carregando times...</span>
        </div>
      ) : teams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 14 }}>Nenhum time criado</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {teams.map((t, idx) => {
            const tc = teamColors[idx % teamColors.length]!
            return (
              <div key={t.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ background: tc.bg, color: tc.color, borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
                    <button style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>···</button>
                  </div>
                </div>

                {/* Leader */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Líder</div>
                  {t.leader ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(t.leader.name)}</div>
                      <span style={{ fontSize: 13, color: '#e8eaf0', fontWeight: 500 }}>{t.leader.name}</span>
                      <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>Líder</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Sem líder definido</span>
                  )}
                </div>

                {/* Members */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Membros</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {t.members.length === 0 ? (
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Nenhum membro</span>
                    ) : (
                      <>
                        {t.members.slice(0, 5).map((m, i) => (
                          <div key={m.id} style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', color: '#e8eaf0', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #161a22', marginLeft: i > 0 ? -8 : 0, zIndex: t.members.length - i }}>{ini(m.user.name)}</div>
                        ))}
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{t.members.length} membro{t.members.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Separator */}
                <div style={{ height: 1, background: '#22283a', margin: '0 0 16px' }} />

                {/* Distribution */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
                  <Shuffle size={14} strokeWidth={1.5} />
                  <span>Distribuição de leads</span>
                </div>

                {/* Action */}
                <button style={{ width: '100%', background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 0', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Gerenciar membros</button>
              </div>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}
