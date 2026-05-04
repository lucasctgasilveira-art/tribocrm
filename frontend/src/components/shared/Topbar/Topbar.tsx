import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, BellRing, BellOff, Search, Mail, ShieldCheck, AlertCircle, CheckCircle2, UserPlus, User, Key, LogOut, X, Loader2, Repeat,
  type LucideIcon,
} from 'lucide-react'
import {
  getNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
} from '../../../services/notifications.service'
import {
  isPushSupported,
  currentPermission,
  enablePushNotifications,
  disablePushNotifications,
} from '../../../services/push.service'
import api from '../../../services/api'

/* ── types ── */

interface ApiNotification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

interface DisplayNotification {
  id: string
  icon: LucideIcon
  iconColor: string
  title: string
  subtitle: string
  time: string
  read: boolean
}

/* ── helpers ── */

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const typeIconMap: Record<string, { icon: LucideIcon; color: string }> = {
  EMAIL_OPENED: { icon: Mail, color: '#3b82f6' },
  DISCOUNT_PENDING: { icon: ShieldCheck, color: '#22c55e' },
  GOAL_ALERT: { icon: AlertCircle, color: '#f59e0b' },
  TASK_DUE: { icon: AlertCircle, color: '#f97316' },
  BIRTHDAY: { icon: CheckCircle2, color: '#a855f7' },
  WHATSAPP_FAILED: { icon: AlertCircle, color: '#ef4444' },
}

const defaultIcon = { icon: UserPlus, color: '#f97316' }

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} minuto${minutes > 1 ? 's' : ''}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} hora${hours > 1 ? 's' : ''}`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days > 1 ? 's' : ''}`
}

function mapNotification(n: ApiNotification): DisplayNotification {
  const config = typeIconMap[n.type] ?? defaultIcon
  return {
    id: n.id,
    icon: config.icon,
    iconColor: config.color,
    title: n.title,
    subtitle: n.body,
    time: formatTimeAgo(n.createdAt),
    read: n.isRead,
  }
}

/* ── component ── */

interface TopbarProps {
  onOpenSearch?: () => void
}

export default function Topbar({ onOpenSearch }: TopbarProps) {
  const [userState, setUserState] = useState(() => JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string; avatarUrl?: string; email?: string; tenantName?: string })
  const initials = getInitials(userState.name ?? 'U')

  useEffect(() => {
    function onUserUpdated() { setUserState(JSON.parse(localStorage.getItem('user') ?? '{}')) }
    window.addEventListener('userUpdated', onUserUpdated)
    return () => window.removeEventListener('userUpdated', onUserUpdated)
  }, [])

  const [showNotif, setShowNotif] = useState(false)
  const [notifications, setNotifications] = useState<DisplayNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotifications = useCallback(async () => {
    try {
      const result = await getNotifications()
      setNotifications(result.data.map(mapNotification))
      setUnreadCount(result.meta.unreadCount)
    } catch { /* ignore — token may not exist yet */ }
  }, [])

  // Load on mount + poll every 60s
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) return

    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  /* close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    if (showNotif) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotif])

  async function markAllRead() {
    try {
      await markAllAsReadApi()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  async function markRead(id: string) {
    try {
      await markAsReadApi(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        zIndex: 40,
      }}
    >
      {/* Left — Company name */}
      {userState.tenantName && (
        <div style={{ position: 'absolute', left: 24, display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>CRM — {userState.tenantName}</span>
        </div>
      )}

      {/* Center — search bar */}
      <div
        onClick={onOpenSearch}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 240,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>Buscar...</span>
        <span
          style={{
            background: 'var(--border)',
            color: 'var(--text-muted)',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          Ctrl+K
        </span>
      </div>

      {/* Right — Bell + Avatar */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Bell */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setShowNotif(!showNotif)}
            style={{ position: 'relative', cursor: 'pointer' }}
          >
            <Bell size={18} color="var(--text-secondary)" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  background: 'var(--red)',
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
                {unreadCount}
              </span>
            )}
          </div>

          {/* dropdown */}
          {showNotif && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 360,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-dropdown)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              {/* header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Notificações</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              {/* list */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Nenhuma notificação
                  </div>
                ) : notifications.map((n) => {
                  const Icon = n.icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.read) markRead(n.id) }}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        gap: 10,
                        cursor: 'pointer',
                        background: n.read ? 'transparent' : 'rgba(249,115,22,0.04)',
                        borderLeft: n.read ? 'none' : '2px solid var(--accent)',
                        opacity: n.read ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = n.read ? 'var(--hover-bg)' : 'rgba(249,115,22,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(249,115,22,0.04)')}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: `${n.iconColor}1F`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={16} color={n.iconColor} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{n.subtitle}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{n.time}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* footer */}
              <div
                style={{
                  padding: 12,
                  borderTop: '1px solid var(--border)',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 13, color: 'var(--accent)' }}>Ver todas as notificações →</span>
              </div>
            </div>
          )}
        </div>

        {/* Avatar + User Menu */}
        <UserMenu initials={initials} userName={userState.name ?? ''} userEmail={userState.email ?? ''} avatarUrl={userState.avatarUrl ?? ''} />
      </div>
    </header>
  )
}

// ── User Menu ──

function UserMenu({ initials, userName, userEmail, avatarUrl }: { initials: string; userName: string; userEmail: string; avatarUrl: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [profileModal, setProfileModal] = useState(false)
  const [passwordModal, setPasswordModal] = useState(false)
  const [notifModal, setNotifModal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Acesso administrativo dual (Super Admin pode alternar entre tela
  // de seleção e a instância gestor que usa pra testar). Bloqueio com
  // verificação dupla pra impedir vazamento pra outros usuários:
  //   1. role === 'SUPER_ADMIN' (precisa ser admin de plataforma)
  //   2. email === 'admin@tribocrm.com.br' (conta específica do Lucas)
  // Email é UNIQUE no banco (constraint da tabela users) — ninguém
  // pode criar outra conta com esse email. Se uma das condições
  // falhar, o item literalmente não vai pra DOM.
  const canSwitchAccess = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string; email?: string }
      return stored.role === 'SUPER_ADMIN' && stored.email === 'admin@tribocrm.com.br'
    } catch {
      return false
    }
  })()

  // Item "Notificações" só aparece pra usuário não Super Admin (Super
  // Admin não recebe os 3 eventos: lead atribuído, tarefa vencendo,
  // desconto pendente) e em navegador que suporta Push API.
  const canManagePush = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string }
      return stored.role !== 'SUPER_ADMIN' && isPushSupported()
    } catch {
      return false
    }
  })()

  useEffect(() => {
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function handleLogout() {
    api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {avatarUrl ? (
        <img onClick={() => setOpen(!open)} src={avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} />
      ) : (
        <div onClick={() => setOpen(!open)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {initials}
        </div>
      )}

      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 260, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-dropdown)', zIndex: 50, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 12px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{userName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{userEmail}</div>
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <MenuItem icon={User} label="Meu perfil" onClick={() => { setOpen(false); setProfileModal(true) }} />
          <MenuItem icon={Key} label="Alterar senha" onClick={() => { setOpen(false); setPasswordModal(true) }} />
          {canManagePush && (
            <MenuItem icon={BellRing} label="Notificações" onClick={() => { setOpen(false); setNotifModal(true) }} />
          )}
          {canSwitchAccess && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <MenuItem icon={Repeat} label="Voltar à tela de escolha" onClick={() => { setOpen(false); navigate('/admin/select-access') }} />
            </>
          )}
          <div style={{ height: 1, background: 'var(--border)' }} />
          <MenuItem icon={LogOut} label="Sair" onClick={handleLogout} color="#ef4444" />
        </div>
      )}

      {profileModal && <ProfileModal userName={userName} onClose={() => setProfileModal(false)} />}
      {passwordModal && <PasswordModal onClose={() => setPasswordModal(false)} />}
      {notifModal && <NotificationsModal onClose={() => setNotifModal(false)} />}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, color }: { icon: LucideIcon; label: string; onClick: () => void; color?: string }) {
  return (
    <div onClick={onClick} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: color ?? 'var(--text-primary)', transition: 'background 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      <Icon size={16} strokeWidth={1.5} />
      <span>{label}</span>
    </div>
  )
}

function ProfileModal({ userName, onClose }: { userName: string; onClose: () => void }) {
  const [name, setName] = useState(userName)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const stored = JSON.parse(localStorage.getItem('user') ?? '{}') as { avatarUrl?: string; name?: string }
  const [avatarUrl, setAvatarUrl] = useState(stored.avatarUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const ini = (stored.name ?? userName).split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await api.patch('/users/me', fd)
      const url = res.data.data.avatarUrl
      setAvatarUrl(url)
      const s = JSON.parse(localStorage.getItem('user') ?? '{}')
      s.avatarUrl = url
      localStorage.setItem('user', JSON.stringify(s))
      window.dispatchEvent(new Event('userUpdated'))
    } catch { /* ignore */ }
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch('/users/me', { name, phone })
      const s = JSON.parse(localStorage.getItem('user') ?? '{}')
      s.name = name
      localStorage.setItem('user', JSON.stringify(s))
      window.dispatchEvent(new Event('userUpdated'))
      setToast('Perfil atualizado!')
      setTimeout(() => { setToast(''); onClose() }, 1500)
    } catch { setSaving(false) }
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 70 }}>{toast}</div>}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Meu Perfil</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini}</div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              {uploading ? 'Enviando...' : 'Alterar foto'}
            </button>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Telefone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" style={inputS} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </>
  )
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  async function handleSave() {
    if (newPw !== confirm) { setError('Senhas não conferem'); return }
    if (newPw.length < 6) { setError('Mínimo 6 caracteres'); return }
    setSaving(true)
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: newPw })
      setToast('Senha alterada com sucesso!')
      setTimeout(() => { setToast(''); onClose() }, 1500)
    } catch { setError('Senha atual incorreta'); setSaving(false) }
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 70 }}>{toast}</div>}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Alterar Senha</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Senha atual</label>
            <input type="password" value={current} onChange={e => { setCurrent(e.target.value); setError('') }} style={inputS} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nova senha</label>
            <input type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setError('') }} style={inputS} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Confirmar nova senha</label>
            <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }} style={inputS} />
          </div>
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !current || !newPw || !confirm} style={{ background: current && newPw && confirm ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: current && newPw && confirm ? '#fff' : 'var(--text-muted)', cursor: current && newPw && confirm ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Salvando...' : 'Alterar senha'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Notifications Modal ──
//
// Gerenciamento manual de Web Push pelo usuário. Acessível via menu do
// usuário > "Notificações". Mostra estado atual (granted / default /
// denied) e o que o user pode fazer em cada um:
//
//   - granted: já ativadas → botão "Desativar neste dispositivo"
//     (chama disablePushNotifications: unsubscribe + DELETE backend).
//   - default: nunca aceitou nem negou → botão "Ativar agora"
//     (mesmo fluxo do PushPermissionPrompt: VAPID + SW + permissão
//     nativa + subscribe + POST backend).
//   - denied: bloqueado no navegador → instruções de como destravar
//     manualmente (clique no cadeado, mudar Notificações pra Permitir,
//     F5). Não tem como destravar via JS.
//
// Self-gate no UserMenu: só renderiza pra não Super Admin e em
// navegador que suporta Push API. Se chegou aqui, condições garantidas.

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [perm, setPerm] = useState(currentPermission())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  async function handleEnable() {
    setBusy(true)
    setError('')
    try {
      // Se já está bloqueado, não chama enablePushNotifications (que
      // mostraria prompt nativo do nada). Atualiza estado pra view denied.
      if (currentPermission() === 'denied') {
        setPerm('denied')
        setBusy(false)
        return
      }
      const result = await enablePushNotifications()
      setPerm(result)
      if (result === 'granted') {
        setToast('Notificações ativadas!')
        setTimeout(() => setToast(''), 1800)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Erro inesperado. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setBusy(true)
    setError('')
    try {
      await disablePushNotifications()
      // Permissão do navegador continua granted (não dá pra revogar via JS),
      // mas a subscription foi removida. Pra próxima vez que abrir esse
      // modal, currentPermission() ainda vai retornar 'granted'. Por isso
      // mostramos toast e fechamos — fluxo claro pro user.
      setToast('Notificações desativadas neste dispositivo.')
      setTimeout(() => { setToast(''); onClose() }, 1500)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao desativar. Tente novamente.')
      setBusy(false)
    }
  }

  const granted = perm === 'granted'
  const denied = perm === 'denied'

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 70 }}>
          {toast}
        </div>
      )}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 460, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Notificações</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Status card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: granted ? 'rgba(34,197,94,0.12)' : denied ? 'rgba(239,68,68,0.10)' : 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {granted ? (
                <CheckCircle2 size={20} color="#22c55e" strokeWidth={2} />
              ) : denied ? (
                <BellOff size={20} color="#ef4444" strokeWidth={2} />
              ) : (
                <BellRing size={20} color="#f97316" strokeWidth={2} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {granted ? 'Ativadas neste dispositivo' : denied ? 'Bloqueadas pelo navegador' : 'Não ativadas'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {granted ? 'Você recebe avisos mesmo com o navegador fechado.'
                  : denied ? 'Permissão precisa ser liberada nas configurações do site.'
                  : 'Receba aviso na hora de leads, tarefas e descontos.'}
              </div>
            </div>
          </div>

          {/* Default — pre-prompt resumido */}
          {!granted && !denied && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                Você recebe um aviso direto na tela quando:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8 }}>
                <li>Um lead novo cair na sua mão</li>
                <li>Uma tarefa importante estiver pra vencer</li>
                <li>Um desconto que você pediu for aprovado</li>
              </ul>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic', margin: '12px 0 0' }}>
                Funciona mesmo com o navegador fechado.
              </p>
            </>
          )}

          {/* Denied — 3 passos pra destravar */}
          {denied && (
            <div style={{ padding: '14px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Como destravar em 3 passos:</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0 }}>1.</span>
                <span>Clique no ícone <strong style={{ color: 'var(--text-primary)' }}>🔒 cadeado</strong> à esquerda do endereço do site (no topo do navegador)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0 }}>2.</span>
                <span>Em <strong style={{ color: 'var(--text-primary)' }}>Notificações</strong>, mude de "Bloquear" para <strong style={{ color: '#22c55e' }}>"Permitir"</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0 }}>3.</span>
                <span>Recarregue a página (F5) e abra esse menu de novo</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={onClose} disabled={busy} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            Fechar
          </button>
          {granted && (
            <button onClick={handleDisable} disabled={busy} style={{ background: 'transparent', border: '1px solid #ef4444', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#ef4444', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Desativando...' : 'Desativar'}
            </button>
          )}
          {!granted && !denied && (
            <button onClick={handleEnable} disabled={busy} style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: busy ? 0.7 : 1 }}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Ativando...' : '⚡ Ativar agora'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
