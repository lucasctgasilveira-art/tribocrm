import { useState } from 'react'
import { Plus, MoreHorizontal, Search } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

interface User {
  id: string; initials: string; name: string; role: string; team: string; active: boolean
  leads: number; deals: number; conv: string; lastAccess: string; custom?: boolean
}

const users: User[] = [
  { id: '1', initials: 'AS', name: 'Ana Souza', role: 'Vendedora', team: 'Time Sul', active: true, leads: 32, deals: 6, conv: '18%', lastAccess: 'hoje 08:45' },
  { id: '2', initials: 'PG', name: 'Pedro Gomes', role: 'Vendedor', team: 'Time Sul', active: true, leads: 38, deals: 9, conv: '23%', lastAccess: 'hoje 09:12' },
  { id: '3', initials: 'LC', name: 'Lucas Castro', role: 'Vendedor', team: 'Time Norte', active: true, leads: 29, deals: 5, conv: '17%', lastAccess: 'ontem 16:30' },
  { id: '4', initials: 'MR', name: 'Mariana Reis', role: 'Líder', team: 'Time Norte', active: true, leads: 24, deals: 4, conv: '16%', lastAccess: 'ontem 18:30', custom: true },
  { id: '5', initials: 'TB', name: 'Thiago Bastos', role: 'Vendedor', team: 'Time Sul', active: false, leads: 18, deals: 2, conv: '11%', lastAccess: 'há 5 dias' },
]

const menuOpts = ['Editar perfil', 'Redefinir senha', 'Ver atividades', 'Desativar']

const dd: React.CSSProperties = {
  background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
  padding: '0 28px 0 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', height: 36,
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [roleF, setRoleF] = useState('Todos')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const filtered = users.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false
    if (roleF !== 'Todos' && u.role !== roleF) return false
    return true
  })

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Usuários</h1>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Usuário
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>5</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>4</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Líderes</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>1</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Gestores</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>1</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
          <Search size={15} color="#6b7280" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..."
            style={{ width: '100%', background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: '#e8eaf0', outline: 'none', height: 36, boxSizing: 'border-box' }} />
        </div>
        <select value={roleF} onChange={e => setRoleF(e.target.value)} style={dd}>
          <option>Todos</option><option>Vendedor</option><option>Vendedora</option><option>Líder</option><option>Gestor</option>
        </select>
        <select style={dd}><option>Todos os times</option><option>Time Sul</option><option>Time Norte</option></select>
        <select style={dd}><option>Todos</option><option>Ativo</option><option>Inativo</option></select>
      </div>

      {/* User cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {filtered.map(u => (
          <div key={u.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, opacity: u.active ? 1 : 0.6 }}>
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{u.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{u.name}</span>
                  {u.custom && <span style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>✦ custom</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{u.role} · {u.team}</span>
                </div>
              </div>
              <span style={{ background: u.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: u.active ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                {u.active ? '🟢 Ativo' : '⚪ Inativo'}
              </span>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <MiniStat label="Leads" value={String(u.leads)} />
              <MiniStat label="Fechamentos" value={String(u.deals)} />
              <MiniStat label="Conversão" value={u.conv} />
            </div>

            {/* Last access */}
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
              Último acesso: {u.lastAccess}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
              <button style={{ flex: 1, background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '7px 0', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
              <button onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #22283a', background: openMenu === u.id ? '#22283a' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
              {openMenu === u.id && (
                <div style={{ position: 'absolute', right: 0, bottom: 40, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 170, padding: '4px 0' }}>
                  {menuOpts.map(opt => (
                    <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Desativar' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginTop: 2 }}>{value}</div>
    </div>
  )
}
