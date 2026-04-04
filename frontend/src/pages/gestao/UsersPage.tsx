import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, MoreHorizontal, Search, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getUsers, updateUser } from '../../services/users.service'

// ── Types ──

interface UserTeam { id: string; name: string }

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
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

const menuOpts = ['Editar perfil', 'Redefinir senha', 'Ver atividades', 'Desativar']

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
  const [activeF, setActiveF] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

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
      if (activeF) params.isActive = activeF
      const data = await getUsers(params)
      setUsers(data)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, roleF, activeF])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleDeactivate(id: string) {
    try {
      await updateUser(id, { isActive: false })
      setOpenMenu(null)
      loadUsers()
    } catch { /* ignore */ }
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
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
          <Search size={15} color="#6b7280" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar usuário..."
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36, boxSizing: 'border-box' }} />
        </div>
        <select value={roleF} onChange={e => setRoleF(e.target.value)} style={dd}>
          <option value="">Todos os cargos</option>
          <option value="MANAGER">Gestor</option>
          <option value="TEAM_LEADER">Líder</option>
          <option value="SELLER">Vendedor</option>
        </select>
        <select value={activeF} onChange={e => setActiveF(e.target.value)} style={dd}>
          <option value="">Todos</option>
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
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
                <span style={{ background: u.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: u.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                  {u.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              {/* Email */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{u.email}</div>

              {/* Last access */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                Último acesso: {formatLastAccess(u.lastLoginAt)}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                <button style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 0', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                <button onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: openMenu === u.id ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <MoreHorizontal size={14} strokeWidth={1.5} />
                </button>
                {openMenu === u.id && (
                  <div style={{ position: 'absolute', right: 0, bottom: 40, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 170, padding: '4px 0' }}>
                    {menuOpts.map(opt => (
                      <div key={opt}
                        onClick={() => {
                          if (opt === 'Desativar') handleDeactivate(u.id)
                          else setOpenMenu(null)
                        }}
                        style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Desativar' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
