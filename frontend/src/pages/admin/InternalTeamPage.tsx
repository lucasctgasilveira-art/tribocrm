import { useState, useEffect, useCallback } from 'react'
import { Plus, MoreHorizontal, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import api from '../../services/api'

interface Member {
  id: string; name: string; email: string; role: string; isActive: boolean
  isDualAccess?: boolean
  lastLoginAt: string | null; createdAt: string
}

// Read once at module scope so the CreateMemberModal + EditMemberModal
// inline components can decide whether to render the dual-access
// toggle at all. Only callers who themselves have isDualAccess=true
// may grant/revoke it.
function callerHasDualAccess(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { isDualAccess?: boolean; role?: string }
    return u.role === 'SUPER_ADMIN' && u.isDualAccess === true
  } catch { return false }
}

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'FINANCIAL', label: 'Financeiro', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { value: 'SUPPORT', label: 'Suporte', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  { value: 'COMMERCIAL', label: 'Comercial', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
]

function roleInfo(role: string) { return ROLES.find(r => r.value === role) || { value: role, label: role, color: '#6b7280', bg: 'rgba(107,114,128,0.12)' } }
function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') }
function formatDate(d: string | null) {
  if (!d) return 'Nunca'
  const dt = new Date(d)
  const now = new Date()
  const diff = now.getTime() - dt.getTime()
  if (diff < 86400000) return `hoje ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (diff < 172800000) return `ontem ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return dt.toLocaleDateString('pt-BR')
}

const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

export default function InternalTeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [modal, setModal] = useState<'create' | 'edit' | 'password' | null>(null)
  const [editMember, setEditMember] = useState<Member | null>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/team')
      if (data.success) setMembers(data.data)
    } catch { showToast('Erro ao carregar equipe', 'err') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleToggleStatus(m: Member) {
    setOpenMenu(null)
    try {
      const { data } = await api.patch(`/admin/team/${m.id}/status`)
      if (data.success) {
        setMembers(prev => prev.map(x => x.id === m.id ? data.data : x))
        showToast(data.data.isActive ? 'Membro reativado' : 'Membro desativado')
      }
    } catch (e: any) { showToast(e.response?.data?.error?.message ?? 'Erro ao alterar status', 'err') }
  }

  function openEdit(m: Member) { setEditMember(m); setModal('edit'); setOpenMenu(null) }
  function openResetPassword(m: Member) { setEditMember(m); setModal('password'); setOpenMenu(null) }

  const activeCount = members.filter(m => m.isActive).length
  const superAdminCount = members.filter(m => m.role === 'SUPER_ADMIN').length

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Equipe Interna</h1>
        <button onClick={() => { setEditMember(null); setModal('create') }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Novo Membro</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 20 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{members.length}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Super Admins</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>{superAdminCount}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{activeCount}</span>
      </div>

      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `4px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast.msg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {members.map(m => {
            const ri = roleInfo(m.role)
            return (
              <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, opacity: m.isActive ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(m.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                    <span style={{ background: ri.bg, color: ri.color, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{ri.label}</span>
                  </div>
                  <span style={{ background: m.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: m.isActive ? '#22c55e' : '#ef4444', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{m.isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Último acesso: {formatDate(m.lastLoginAt)}</div>
                <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                  <button onClick={() => openEdit(m)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 0', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <MoreHorizontal size={14} strokeWidth={1.5} />
                  </button>
                  {openMenu === m.id && (
                    <div style={{ position: 'absolute', right: 0, bottom: 40, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 160, padding: '4px 0' }}>
                      <div onClick={() => openEdit(m)} style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>Editar perfil</div>
                      <div onClick={() => openResetPassword(m)} style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>Resetar senha</div>
                      <div onClick={() => handleToggleStatus(m)} style={{ padding: '8px 14px', fontSize: 13, color: m.isActive ? '#ef4444' : '#22c55e', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{m.isActive ? 'Desativar' : 'Reativar'}</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'create' && (
        <CreateMemberModal
          onClose={() => setModal(null)}
          onCreated={m => { setMembers(prev => [m, ...prev]); setModal(null); showToast('Membro criado com sucesso!') }}
          onDualAccessGranted={() => showToast('Acesso duplo concedido')}
        />
      )}
      {modal === 'edit' && editMember && (
        <EditMemberModal
          member={editMember}
          onClose={() => setModal(null)}
          onSaved={m => { setMembers(prev => prev.map(x => x.id === m.id ? m : x)); setModal(null); showToast('Membro atualizado!') }}
          onDualAccessChanged={(granted) => showToast(granted ? 'Acesso duplo concedido' : 'Acesso duplo revogado')}
        />
      )}
      {modal === 'password' && editMember && (
        <ResetPasswordModal
          member={editMember}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); showToast('Senha redefinida com sucesso!') }}
        />
      )}
    </AppLayout>
  )
}

/* ── Create Modal ── */
function CreateMemberModal({ onClose, onCreated, onDualAccessGranted }: { onClose: () => void; onCreated: (m: Member) => void; onDualAccessGranted: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('SUPPORT')
  const [password, setPassword] = useState('')
  const [dualAccess, setDualAccess] = useState(false)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canGrant = callerHasDualAccess()
  const canSave = !!(name.trim() && email.trim() && password.trim() && (!dualAccess || ownerPassword.trim()))

  async function handleSave() {
    if (!canSave) return
    setSaving(true); setError('')
    try {
      const { data } = await api.post('/admin/team', { name, email, role, password })
      if (!data.success) return
      const created: Member = data.data

      // If the grantor asked for dual access, chain the second call.
      // If the dual-access endpoint fails (bad password etc) the member
      // still exists — we surface the error and let them retry via the
      // edit flow.
      if (dualAccess) {
        try {
          const { data: grantData } = await api.patch(`/admin/users/${created.id}/dual-access`, {
            isDualAccess: true,
            ownerPassword,
          })
          if (grantData.success) {
            onCreated(grantData.data as Member)
            onDualAccessGranted()
            return
          }
        } catch (e: any) {
          const msg = e.response?.data?.error?.message ?? 'Erro ao conceder acesso duplo'
          setError(msg)
          onCreated(created)
          setSaving(false)
          return
        }
      }

      onCreated(created)
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao criar membro')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Novo Membro" onClose={onClose}>
      <div style={{ padding: 24 }}>
        <Field label="Nome completo"><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do membro" style={inputS} /></Field>
        <Field label="E-mail"><input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@tribocrm.com.br" style={inputS} /></Field>
        <Field label="Cargo">
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Senha temporária" last={!canGrant}><input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha inicial" type="password" style={inputS} /></Field>
        {canGrant && (
          <DualAccessToggle
            value={dualAccess}
            onChange={setDualAccess}
            ownerPassword={ownerPassword}
            onOwnerPasswordChange={setOwnerPassword}
          />
        )}
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} disabled={!canSave || saving} label={saving ? 'Criando...' : 'Criar membro'} canSave={canSave} />
    </ModalShell>
  )
}

/* ── Edit Modal ── */
function EditMemberModal({ member, onClose, onSaved, onDualAccessChanged }: { member: Member; onClose: () => void; onSaved: (m: Member) => void; onDualAccessChanged: (granted: boolean) => void }) {
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [role, setRole] = useState(member.role)
  const [dualAccess, setDualAccess] = useState<boolean>(!!member.isDualAccess)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canGrant = callerHasDualAccess()
  const dualAccessChanged = dualAccess !== !!member.isDualAccess
  const canSave = !!(name.trim() && email.trim() && (!dualAccessChanged || ownerPassword.trim()))

  async function handleSave() {
    if (!canSave) return
    setSaving(true); setError('')
    try {
      const { data } = await api.patch(`/admin/team/${member.id}`, { name, email, role })
      if (!data.success) return
      let updated: Member = data.data

      if (dualAccessChanged) {
        try {
          const { data: grantData } = await api.patch(`/admin/users/${member.id}/dual-access`, {
            isDualAccess: dualAccess,
            ownerPassword,
          })
          if (grantData.success) {
            updated = grantData.data as Member
            onDualAccessChanged(dualAccess)
          }
        } catch (e: any) {
          setError(e.response?.data?.error?.message ?? 'Erro ao alterar acesso duplo')
          setSaving(false)
          return
        }
      }

      onSaved(updated)
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao atualizar membro')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Editar Membro" onClose={onClose}>
      <div style={{ padding: 24 }}>
        <Field label="Nome completo"><input value={name} onChange={e => setName(e.target.value)} style={inputS} /></Field>
        <Field label="E-mail"><input value={email} onChange={e => setEmail(e.target.value)} style={inputS} /></Field>
        <Field label="Cargo" last={!canGrant}>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        {canGrant && (
          <DualAccessToggle
            value={dualAccess}
            onChange={setDualAccess}
            ownerPassword={ownerPassword}
            onOwnerPasswordChange={setOwnerPassword}
            passwordPromptLabel={dualAccess
              ? 'Confirme sua senha para conceder este acesso'
              : 'Confirme sua senha para revogar este acesso'}
          />
        )}
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} disabled={!canSave || saving} label={saving ? 'Salvando...' : 'Salvar'} canSave={canSave} />
    </ModalShell>
  )
}

/* ── Reset Password Modal ── */
function ResetPasswordModal({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!password.trim()) return
    setSaving(true); setError('')
    try {
      const { data } = await api.patch(`/admin/team/${member.id}/password`, { password })
      if (data.success) onSaved()
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao redefinir senha')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Resetar senha — ${member.name}`} onClose={onClose}>
      <div style={{ padding: 24 }}>
        <Field label="Nova senha" last><input value={password} onChange={e => setPassword(e.target.value)} placeholder="Nova senha" type="password" style={inputS} /></Field>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} disabled={!password.trim() || saving} label={saving ? 'Salvando...' : 'Redefinir senha'} canSave={!!password.trim()} />
    </ModalShell>
  )
}

/* ── Shared components ── */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        {children}
      </div>
    </>
  )
}

function ModalFooter({ onClose, onSave, disabled, label, canSave }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string; canSave: boolean }) {
  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
      <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
      <button onClick={onSave} disabled={disabled} style={{ background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
      </button>
    </div>
  )
}

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 16 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

/* ── Dual Access toggle ── */
// Used by both Create and Edit modals. Only rendered when the caller
// themselves has isDualAccess=true; gating is the caller's responsibility.
// When the checkbox flips, an inline password confirmation field expands
// below so the grantor must re-type their own password before the save
// button fires the PATCH /admin/users/:id/dual-access call.
function DualAccessToggle({
  value,
  onChange,
  ownerPassword,
  onOwnerPasswordChange,
  passwordPromptLabel = 'Confirme sua senha para conceder este acesso',
}: {
  value: boolean
  onChange: (next: boolean) => void
  ownerPassword: string
  onOwnerPasswordChange: (next: string) => void
  passwordPromptLabel?: string
}) {
  return (
    <div style={{ marginTop: 16, padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#f97316', cursor: 'pointer' }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            Conceder acesso duplo (Super Admin + Gestor)
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Permite que este membro escolha entre o painel interno e a instância Gestor ao entrar.
          </div>
        </div>
      </label>
      {value && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{passwordPromptLabel}</label>
          <input
            type="password"
            value={ownerPassword}
            onChange={(e) => onOwnerPasswordChange(e.target.value)}
            placeholder="Sua senha"
            style={inputS}
          />
        </div>
      )}
    </div>
  )
}
