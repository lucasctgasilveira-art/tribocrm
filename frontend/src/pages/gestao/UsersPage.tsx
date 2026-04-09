import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Search, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getUsers, updateUser, createUser, getTeams, type CreateUserResult } from '../../services/users.service'
import { bulkUpdateLeads } from '../../services/leads.service'

// ── Types ──

interface UserTeam { id: string; name: string }

type UserStatus = 'ACTIVE' | 'VACATION' | 'INACTIVE'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  userStatus: UserStatus
  lastLoginAt: string | null
  createdAt: string
  teams: UserTeam[]
}

// ── Helpers ──

function ini(n: string): string {
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatLastAccess(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'agora'
  if (hours < 24) {
    const d = new Date(dateStr)
    return `hoje ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

const roleLabels: Record<string, string> = {
  OWNER: 'Dono',
  MANAGER: 'Gestor',
  TEAM_LEADER: 'Líder',
  SELLER: 'Vendedor',
}

const dd: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 28px 0 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36,
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

// ── Component ──

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleF, setRoleF] = useState('')
  const [statusF, setStatusF] = useState('')
  const [vacationModal, setVacationModal] = useState<User | null>(null)
  const [toast, setToast] = useState('')
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const [newUserModalOpen, setNewUserModalOpen] = useState(false)
  const [createResult, setCreateResult] = useState<CreateUserResult | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 500)
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (debouncedSearch) params.search = debouncedSearch
      if (roleF) params.role = roleF
      if (statusF === 'ACTIVE') { params.isActive = 'true'; params.userStatus = 'ACTIVE' }
      else if (statusF === 'VACATION') { params.isActive = 'true'; params.userStatus = 'VACATION' }
      else if (statusF === 'INACTIVE') { params.isActive = 'false' }
      const data = await getUsers(params)
      setUsers(data)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, roleF, statusF])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleStatusChange(user: User, newStatus: UserStatus) {
    if (newStatus === 'VACATION') {
      // Open vacation modal to optionally redistribute leads
      setVacationModal(user)
      return
    }
    try {
      await updateUser(user.id, { userStatus: newStatus })
      showToast(newStatus === 'ACTIVE' ? 'Usuário reativado' : 'Usuário desativado')
      loadUsers()
    } catch { showToast('Erro ao alterar status') }
  }

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    leaders: users.filter(u => u.role === 'TEAM_LEADER').length,
    managers: users.filter(u => u.role === 'MANAGER').length,
  }), [users])

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Usuários</h1>
        <button onClick={() => setNewUserModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Usuário
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{stats.active}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Líderes</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.leaders}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Gestores</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.managers}</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
          <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar usuário..."
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36, boxSizing: 'border-box' }} />
        </div>
        <select value={roleF} onChange={e => setRoleF(e.target.value)} style={dd}>
          <option value="">Todos os cargos</option>
          <option value="MANAGER">Gestor</option>
          <option value="TEAM_LEADER">Líder</option>
          <option value="SELLER">Vendedor</option>
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} style={dd}>
          <option value="">Todos</option>
          <option value="ACTIVE">Ativo</option>
          <option value="VACATION">Férias</option>
          <option value="INACTIVE">Inativo</option>
        </select>
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando usuários...</span>
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhum usuário encontrado</div>
      ) : (
        /* User cards grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {users.map(u => (
            <div key={u.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, opacity: u.isActive ? 1 : 0.6 }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(u.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {roleLabels[u.role] ?? u.role}
                      {u.teams.length > 0 ? ` · ${u.teams[0]!.name}` : ''}
                    </span>
                  </div>
                </div>
                {(() => {
                  const st = u.userStatus ?? (u.isActive ? 'ACTIVE' : 'INACTIVE')
                  const cfg: Record<string, { bg: string; color: string; label: string }> = {
                    ACTIVE: { bg: 'rgba(249,115,22,0.12)', color: '#f97316', label: 'Ativo' },
                    VACATION: { bg: 'rgba(234,179,8,0.12)', color: '#eab308', label: 'Férias' },
                    INACTIVE: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', label: 'Inativo' },
                  }
                  const c = cfg[st] ?? cfg.ACTIVE!
                  return <span style={{ background: c.bg, color: c.color, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>{c.label}</span>
                })()}
              </div>

              {/* Email */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{u.email}</div>

              {/* Last access */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                Último acesso: {formatLastAccess(u.lastLoginAt)}
              </div>

              {/* Status selector (3 states) */}
              {(() => {
                const currentSt = u.userStatus ?? (u.isActive ? 'ACTIVE' : 'INACTIVE')
                const opts: { k: UserStatus; l: string; c: string }[] = [
                  { k: 'ACTIVE', l: 'Ativo', c: '#f97316' },
                  { k: 'VACATION', l: 'Férias', c: '#eab308' },
                  { k: 'INACTIVE', l: 'Inativo', c: 'var(--text-muted)' },
                ]
                return (
                  <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
                    {opts.map(o => {
                      const active = currentSt === o.k
                      return (
                        <button key={o.k}
                          onClick={() => { if (!active) handleStatusChange(u, o.k) }}
                          style={{
                            flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, cursor: active ? 'default' : 'pointer',
                            background: active ? o.c : 'transparent',
                            color: active ? (o.k === 'INACTIVE' ? 'var(--text-primary)' : '#fff') : 'var(--text-muted)',
                            transition: 'all 0.15s',
                          }}>
                          {o.l}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {newUserModalOpen && (
        <NewUserModal
          onClose={() => setNewUserModalOpen(false)}
          onCreated={(result) => { setNewUserModalOpen(false); setCreateResult(result); loadUsers() }}
        />
      )}
      {createResult && <CreateResultDialog result={createResult} onClose={() => setCreateResult(null)} />}
      {vacationModal && (
        <VacationModal
          user={vacationModal}
          onClose={() => setVacationModal(null)}
          onDone={(msg) => { setVacationModal(null); showToast(msg); loadUsers() }}
        />
      )}
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast}</div>}
    </AppLayout>
  )
}

// ── New User Modal ──

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: CreateUserResult) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('SELLER')
  const [teamId, setTeamId] = useState('')
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getTeams().then((data: Array<{ id: string; name: string }>) => setTeams(data ?? [])).catch(() => setTeams([]))
  }, [])

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const canSave = name.trim().length >= 2 && emailRe.test(email) && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true); setError('')
    try {
      const result = await createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        teamId: teamId || undefined,
        // password is intentionally omitted — backend generates a temporary one
      })
      onCreated(result)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao criar usuário')
      setSaving(false)
    }
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Usuário</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome <span style={{ color: '#f97316' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" style={inputS} autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>E-mail <span style={{ color: '#f97316' }}>*</span></label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@empresa.com" style={inputS} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Cargo <span style={{ color: '#f97316' }}>*</span></label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputS, appearance: 'none', cursor: 'pointer' }}>
              <option value="SELLER">Vendedor</option>
              <option value="TEAM_LEADER">Líder</option>
              <option value="MANAGER">Gestor</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Equipe <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(opcional)</span></label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} style={{ ...inputS, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Sem equipe</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Uma senha temporária será gerada automaticamente e enviada por e-mail ao usuário com instruções de acesso.
          </div>
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Criando...' : 'Criar usuário'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Vacation Modal (optionally redistribute leads) ──

function VacationModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: (msg: string) => void }) {
  const [redistribute, setRedistribute] = useState(false)
  const [distType, setDistType] = useState<'ROUND_ROBIN_ALL' | 'SPECIFIC_USER' | 'ROUND_ROBIN_TEAM'>('ROUND_ROBIN_ALL')
  const [distUserId, setDistUserId] = useState('')
  const [distTeamId, setDistTeamId] = useState('')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getUsers().then((d: Array<{ id: string; name: string }>) => setUsers(d.filter(u => u.id !== user.id))).catch(() => {})
    getTeams().then((d: Array<{ id: string; name: string }>) => setTeams(d)).catch(() => {})
  }, [user.id])

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer' }

  async function handleConfirm() {
    setSaving(true); setError('')
    try {
      // Set status to VACATION
      await updateUser(user.id, { userStatus: 'VACATION' })

      if (redistribute) {
        // Find all active leads of this user
        const api = (await import('../../services/api')).default
        const res = await api.get('/leads', { params: { responsibleId: user.id, perPage: 1000, status: 'ACTIVE' } })
        const leadIds: string[] = (res.data.data ?? []).map((l: { id: string }) => l.id)
        if (leadIds.length > 0) {
          const payload: Record<string, unknown> = { distributionType: distType }
          if (distType === 'SPECIFIC_USER' && distUserId) payload.responsibleId = distUserId
          if (distType === 'ROUND_ROBIN_TEAM' && distTeamId) payload.teamId = distTeamId
          await bulkUpdateLeads(leadIds, 'redistribute', payload)
        }
      }

      onDone('Usuário marcado como férias' + (redistribute ? ' e leads redistribuídos' : ''))
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao processar')
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Marcar férias — {user.name}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Deseja transferir os leads desse vendedor enquanto estiver de férias?</p>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <label onClick={() => setRedistribute(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, cursor: 'pointer', border: `1px solid ${!redistribute ? '#eab308' : 'var(--border)'}`, background: !redistribute ? 'rgba(234,179,8,0.06)' : 'transparent', borderRadius: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${!redistribute ? '#eab308' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!redistribute && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Não — manter leads como estão</span>
            </label>
            <label onClick={() => setRedistribute(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, cursor: 'pointer', border: `1px solid ${redistribute ? '#eab308' : 'var(--border)'}`, background: redistribute ? 'rgba(234,179,8,0.06)' : 'transparent', borderRadius: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${redistribute ? '#eab308' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {redistribute && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Sim — redistribuir leads</span>
            </label>
          </div>

          {redistribute && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
              {([
                { k: 'ROUND_ROBIN_ALL' as const, l: 'Todos os vendedores (round-robin)' },
                { k: 'SPECIFIC_USER' as const, l: 'Vendedor específico' },
                { k: 'ROUND_ROBIN_TEAM' as const, l: 'Equipe' },
              ]).map(d => {
                const active = distType === d.k
                return (
                  <label key={d.k} onClick={() => setDistType(d.k)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f97316' }} />}
                    </div>
                    {d.l}
                  </label>
                )
              })}
              {distType === 'SPECIFIC_USER' && (
                <select value={distUserId} onChange={e => setDistUserId(e.target.value)} style={inputS}>
                  <option value="">Selecione vendedor...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
              {distType === 'ROUND_ROBIN_TEAM' && (
                <select value={distTeamId} onChange={e => setDistTeamId(e.target.value)} style={inputS}>
                  <option value="">Selecione equipe...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={saving || (redistribute && distType === 'SPECIFIC_USER' && !distUserId) || (redistribute && distType === 'ROUND_ROBIN_TEAM' && !distTeamId)}
            style={{ background: '#eab308', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Processando...' : 'Confirmar férias'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Result Dialog (success / fallback when SMTP not configured) ──

function CreateResultDialog({ result, onClose }: { result: CreateUserResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 460, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, padding: 24 }}>
        {result.emailSent ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <CheckCircle2 size={44} color="#22c55e" strokeWidth={1.5} />
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 6px' }}>Usuário criado!</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Um e-mail de boas-vindas foi enviado para <strong style={{ color: 'var(--text-primary)' }}>{result.email}</strong> com as instruções de acesso.
              </p>
            </div>
            <button onClick={onClose} style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Concluir</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={22} color="#f59e0b" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Usuário criado, mas o e-mail não pôde ser enviado</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  O servidor SMTP não está configurado ou retornou erro. Entregue manualmente os dados de acesso para <strong style={{ color: 'var(--text-primary)' }}>{result.email}</strong>:
                </p>
              </div>
            </div>
            {result.tempPassword && (
              <div style={{ background: 'var(--bg)', border: '2px solid #f97316', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <code style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 2, fontFamily: 'monospace' }}>{result.tempPassword}</code>
                <button onClick={() => { navigator.clipboard.writeText(result.tempPassword!); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Esta senha não poderá ser recuperada depois — copie antes de fechar.</div>
            <button onClick={onClose} style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Concluir</button>
          </>
        )}
      </div>
    </>
  )
}
