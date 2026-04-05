import { useState } from 'react'
import { Plus, MoreHorizontal, X } from 'lucide-react'
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
  const [newMemberModal, setNewMemberModal] = useState(false)

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Equipe Interna</h1>
        <button onClick={() => setNewMemberModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Novo Membro</button>
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
      {newMemberModal && <NewMemberModal onClose={() => setNewMemberModal(false)} />}
    </AppLayout>
  )
}

function NewMemberModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('SUPPORT')
  const [password, setPassword] = useState('')
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const roles = [{ value: 'SUPER_ADMIN', label: 'Super Admin' }, { value: 'FINANCIAL', label: 'Financeiro' }, { value: 'SUPPORT', label: 'Suporte' }, { value: 'COMMERCIAL', label: 'Comercial' }]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Membro</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome completo</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do membro" style={inputS} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@tribocrm.com.br" style={inputS} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Cargo</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Senha temporária</label>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha inicial" style={inputS} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onClose} disabled={!name || !email} style={{ background: name && email ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name && email ? '#fff' : 'var(--text-muted)', cursor: name && email ? 'pointer' : 'not-allowed' }}>Criar membro</button>
        </div>
      </div>
    </>
  )
}
