import { useState, useEffect, useCallback } from 'react'
import { Shuffle, Plus, Loader2, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getTeams, createTeam, updateTeam, getUsers } from '../../services/users.service'

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

interface UserOption { id: string; name: string; role: string }

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [membersTeam, setMembersTeam] = useState<Team | null>(null)
  const [toast, setToast] = useState('')
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [teamsData, usersData] = await Promise.all([getTeams(), getUsers()])
      setTeams(teamsData)
      setUsers(usersData)
    } catch {
      setTeams([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreate(payload: { name: string; leaderId?: string }) {
    try {
      await createTeam(payload)
      setModalOpen(false)
      showToast('Time criado com sucesso!')
      loadData()
    } catch { showToast('Erro ao criar time') }
  }

  async function handleEditSave(teamId: string, payload: { name: string; leaderId?: string }) {
    try {
      await updateTeam(teamId, payload)
      setEditTeam(null)
      showToast('Time atualizado!')
      loadData()
    } catch { showToast('Erro ao atualizar time') }
  }

  async function handleMembersSave(teamId: string, memberIds: string[]) {
    try {
      await updateTeam(teamId, { memberIds })
      setMembersTeam(null)
      showToast('Membros atualizados!')
      loadData()
    } catch { showToast('Erro ao atualizar membros') }
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Times</h1>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Time
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando times...</span>
        </div>
      ) : teams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhum time criado</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {teams.map((t, idx) => {
            const tc = teamColors[idx % teamColors.length]!
            return (
              <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ background: tc.bg, color: tc.color, borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditTeam(t)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                  </div>
                </div>

                {/* Leader */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Líder</div>
                  {t.leader ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(t.leader.name)}</div>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{t.leader.name}</span>
                      <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>Líder</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem líder definido</span>
                  )}
                </div>

                {/* Members */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Membros</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {t.members.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum membro</span>
                    ) : (
                      <>
                        {t.members.slice(0, 5).map((m, i) => (
                          <div key={m.id} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', color: 'var(--text-primary)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-card)', marginLeft: i > 0 ? -8 : 0, zIndex: t.members.length - i }}>{ini(m.user.name)}</div>
                        ))}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{t.members.length} membro{t.members.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Separator */}
                <div style={{ height: 1, background: 'var(--border)', margin: '0 0 16px' }} />

                {/* Distribution */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Shuffle size={14} strokeWidth={1.5} />
                  <span>Distribuição de leads</span>
                </div>

                {/* Action */}
                <button onClick={() => setMembersTeam(t)} style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Gerenciar membros</button>
              </div>
            )
          })}
        </div>
      )}
      {modalOpen && <NewTeamModal users={users} onClose={() => setModalOpen(false)} onSave={handleCreate} />}
      {editTeam && <EditTeamModal team={editTeam} users={users} onClose={() => setEditTeam(null)} onSave={handleEditSave} />}
      {membersTeam && <ManageMembersModal team={membersTeam} users={users} onClose={() => setMembersTeam(null)} onSave={handleMembersSave} />}
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `4px solid ${toast.startsWith('Erro') ? '#ef4444' : '#22c55e'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}
    </AppLayout>
  )
}

// ── New Team Modal ──

const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }
const modalBox: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }
const modalHeader: React.CSSProperties = { padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }
const modalFooter: React.CSSProperties = { padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

function NewTeamModal({ users, onClose, onSave }: { users: UserOption[]; onClose: () => void; onSave: (p: { name: string; leaderId?: string }) => void }) {
  const [name, setName] = useState('')
  const [leaderId, setLeaderId] = useState('')

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const canSave = name.trim().length > 0

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Time</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do time <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Equipe Comercial SP" style={inputS} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Líder do time</label>
            <select value={leaderId} onChange={e => setLeaderId(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="">Selecionar líder...</option>
              {users.filter(u => u.role === 'TEAM_LEADER' || u.role === 'MANAGER' || u.role === 'OWNER').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Tipo de distribuição</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Round-robin automático', desc: 'Leads distribuídos automaticamente entre membros' },
                { label: 'Manual', desc: 'Gestor atribui leads manualmente' },
              ].map((opt, i) => (
                <div key={opt.label} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`, background: i === 0 ? 'rgba(249,115,22,0.06)' : 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (canSave) onSave({ name, leaderId: leaderId || undefined }) }} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>Criar Time</button>
        </div>
      </div>
    </>
  )
}

// ── Edit Team Modal ──

function EditTeamModal({ team, users, onClose, onSave }: { team: Team; users: UserOption[]; onClose: () => void; onSave: (id: string, p: { name: string; leaderId?: string }) => void }) {
  const [name, setName] = useState(team.name)
  const [leaderId, setLeaderId] = useState(team.leader?.id ?? '')
  const canSave = name.trim().length > 0

  return (
    <>
      <div onClick={onClose} style={modalOverlay} />
      <div style={modalBox}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Editar Time</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do time <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Líder do time</label>
            <select value={leaderId} onChange={e => setLeaderId(e.target.value)} style={{ ...inputStyle, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="">Sem líder</option>
              {users.filter(u => u.role === 'TEAM_LEADER' || u.role === 'MANAGER' || u.role === 'OWNER').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (canSave) onSave(team.id, { name, leaderId: leaderId || undefined }) }} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>Salvar</button>
        </div>
      </div>
    </>
  )
}

// ── Manage Members Modal ──

function ManageMembersModal({ team, users, onClose, onSave }: { team: Team; users: UserOption[]; onClose: () => void; onSave: (id: string, memberIds: string[]) => void }) {
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set(team.members.map(m => m.userId)))
  const [addUserId, setAddUserId] = useState('')

  const availableUsers = users.filter(u => !memberIds.has(u.id) && u.id !== team.leader?.id)

  function addMember() {
    if (!addUserId) return
    setMemberIds(prev => new Set([...prev, addUserId]))
    setAddUserId('')
  }

  function removeMember(uid: string) {
    setMemberIds(prev => { const n = new Set(prev); n.delete(uid); return n })
  }

  return (
    <>
      <div onClick={onClose} style={modalOverlay} />
      <div style={modalBox}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Membros — {team.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, maxHeight: 400, overflowY: 'auto' }}>
          {/* Add member */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select value={addUserId} onChange={e => setAddUserId(e.target.value)} style={{ ...inputStyle, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="">Adicionar membro...</option>
              {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <button onClick={addMember} disabled={!addUserId} style={{ background: addUserId ? 'var(--accent)' : 'var(--border)', color: addUserId ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: addUserId ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>
          {/* Members list */}
          {memberIds.size === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Nenhum membro</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from(memberIds).map(uid => {
                const u = users.find(u => u.id === uid)
                return (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(u?.name ?? '?')}</div>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{u?.name ?? uid}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u?.role ?? ''}</span>
                    </div>
                    <button onClick={() => removeMember(uid)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#ef4444', cursor: 'pointer' }}>Remover</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(team.id, Array.from(memberIds))} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Salvar</button>
        </div>
      </div>
    </>
  )
}
