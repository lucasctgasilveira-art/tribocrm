import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Briefcase } from 'lucide-react'

// "Como deseja entrar?" — shown right after login for admin users
// whose `isDualAccess` flag is true. Lets them pick between the
// Super Admin panel (/admin/dashboard) and a gestor-side experience
// (/gestao). The JWT issued at login already covers both surfaces
// because PrivateRoute grants SUPER_ADMIN access to every instance;
// clicking a card is a pure `navigate` — no new token.
//
// Users with `isDualAccess === false` must never reach this page;
// the auth flow short-circuits them straight to /admin/dashboard,
// and this component defensively redirects them the same way if
// they land here via direct URL.

interface StoredUser {
  role?: string
  name?: string
  isDualAccess?: boolean
  linkedTenantId?: string | null
}

function readStoredUser(): StoredUser {
  try { return JSON.parse(localStorage.getItem('user') ?? '{}') as StoredUser }
  catch { return {} }
}

export default function DualAccessSelector() {
  const navigate = useNavigate()
  const user = readStoredUser()

  useEffect(() => {
    // Defensive redirect: unauthenticated, non-super-admin, or
    // single-access users should never see the selector.
    if (!localStorage.getItem('accessToken')) { navigate('/login', { replace: true }); return }
    if (user.role !== 'SUPER_ADMIN') { navigate('/admin/dashboard', { replace: true }); return }
    if (user.isDualAccess !== true) { navigate('/admin/dashboard', { replace: true }); return }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (user.role !== 'SUPER_ADMIN' || user.isDualAccess !== true) return null

  function goToAdmin() {
    // Admin panel doesn't need the linkedTenantId hint. Clear any
    // leftover value so the tracking state never lies when the
    // admin flips back to the super-admin side.
    localStorage.removeItem('dualAccessTenantId')
    navigate('/admin/dashboard', { replace: true })
  }

  function goToGestor() {
    // Persist the linked tenant locally so any frontend code that
    // wants to display "você está em Tribo de Vendas" can read it.
    // The backend tenant swap is driven entirely by the JWT payload
    // (auth.middleware rewrites req.user.tenantId on non-/admin
    // routes) — this localStorage entry is purely a UI hint.
    if (user.linkedTenantId) {
      localStorage.setItem('dualAccessTenantId', user.linkedTenantId)
    } else {
      localStorage.removeItem('dualAccessTenantId')
    }
    navigate('/gestao/dashboard', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 840, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Olá{user.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Como deseja entrar?</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
            Você tem acesso duplo — escolha de qual lado quer trabalhar agora.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, width: '100%' }}>
          <AccessCard
            icon={<Shield size={28} strokeWidth={1.5} color="#f97316" />}
            title="Super Admin"
            subtitle="Painel interno"
            description="Gerenciar planos, clientes, equipe interna e configurações da plataforma TriboCRM."
            onClick={goToAdmin}
          />
          <AccessCard
            icon={<Briefcase size={28} strokeWidth={1.5} color="#f97316" />}
            title="Gestor"
            subtitle="Tribo de Vendas"
            description="Acessar meu time de vendas — pipeline, leads, tarefas e relatórios do dia a dia."
            onClick={goToGestor}
          />
        </div>
      </div>
    </div>
  )
}

function AccessCard({ icon, title, subtitle, description, onClick }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 24px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 220,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'
        e.currentTarget.style.background = 'var(--bg-elevated)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--bg-card)'
      }}
    >
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        background: 'rgba(249,115,22,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{subtitle}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {description}
      </div>
    </button>
  )
}
