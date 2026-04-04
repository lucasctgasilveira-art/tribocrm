import { useState } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

interface Member { id: string; initials: string; name: string; role: string; roleBadge: string; roleColor: string; roleBg: string; lastAccess: string }

const members: Member[] = [
  { id: '1', initials: 'TA', name: 'Tiago Alves', role: 'SUPER_ADMIN', roleBadge: 'Super Admin', roleColor: '#f97316', roleBg: 'rgba(249,115,22,0.12)', lastAccess: 'hoje 08:30' },
  { id: '2', initials: 'MC', name: 'Marina Costa', role: 'FINANCIAL', roleBadge: 'Financeiro', roleColor: '#3b82f6', roleBg: 'rgba(59,130,246,0.12)', lastAccess: 'hoje 09:15' },
  { id: '3', initials: 'RN', name: 'Rafael Nunes', role: 'SUPPORT', roleBadge: 'Suporte', roleColor: '#22c55e', roleBg: 'rgba(34,197,94,0.12)', lastAccess: 'ontem 17:00' },
  { id: '4', initials: 'BL', name: 'Beatriz Lima', role: 'COMMERCIAL', roleBadge: 'Comercial', roleColor: '#a855f7', roleBg: 'rgba(168,85,247,0.12)', lastAccess: 'há 2 dias' },
]

const menuOpts = ['Editar perfil', 'Redefinir senha', 'Desativar']

export default function InternalTeamPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Equipe Interna</h1>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Novo Membro</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 20 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>4</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Super Admins</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>1</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>4</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {members.map(m => (
          <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                <span style={{ background: m.roleBg, color: m.roleColor, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{m.roleBadge}</span>
              </div>
              <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>Ativo</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Último acesso: {m.lastAccess}</div>
            <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
              <button style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 0', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
              <button onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
              {openMenu === m.id && (
                <div style={{ position: 'absolute', right: 0, bottom: 40, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 160, padding: '4px 0' }}>
                  {menuOpts.map(opt => <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Desativar' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
