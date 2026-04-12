import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, XCircle } from 'lucide-react'
import api from '../../services/api'

interface ToastState {
  visible: boolean
  message: string
}

function redirectByRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/dashboard'
    case 'OWNER':
    case 'MANAGER':
    case 'TEAM_LEADER':
      return '/gestao/dashboard'
    case 'SELLER':
    default:
      return '/vendas/dashboard'
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' })

  useEffect(() => {
    if (!toast.visible) return
    const timer = setTimeout(() => setToast({ visible: false, message: '' }), 4000)
    return () => clearTimeout(timer)
  }, [toast.visible])

  function showError(message: string) {
    setToast({ visible: true, message })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data } = await api.post('/auth/login', { email, password })

      if (data.success) {
        localStorage.setItem('accessToken', data.data.accessToken)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        // Dual-access super admins land on the "Como deseja entrar?"
        // selector first. Everyone else falls through to their
        // role-based default route.
        if (data.data.user.role === 'SUPER_ADMIN' && data.data.user.isDualAccess === true) {
          navigate('/admin/select-access')
        } else {
          navigate(redirectByRole(data.data.user.role))
        }
      }
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object'
      ) {
        const response = (err as { response: { data?: { error?: { message?: string } } } }).response
        showError(response.data?.error?.message ?? 'E-mail ou senha incorretos.')
      } else {
        showError('Erro de conexão com o servidor.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '16px',
      }}
    >
      {/* Toast */}
      {toast.visible && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: 'var(--bg-card)',
            borderLeft: '4px solid #ef4444',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <XCircle size={18} color="#ef4444" strokeWidth={1.5} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{toast.message}</span>
        </div>
      )}

      {/* Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 40,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
            <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
            <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
          </h1>
        </div>

        {/* Subtitle */}
        <p
          style={{
            textAlign: 'center',
            fontSize: 11,
            letterSpacing: '0.2em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 32,
            marginTop: 0,
          }}
        >
          Máquina de Vendas
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Email */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f97316'
                  e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 44px 10px 14px',
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f97316'
                    e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? (
                    <Eye size={18} color="var(--text-muted)" strokeWidth={1.5} />
                  ) : (
                    <EyeOff size={18} color="var(--text-muted)" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: 'right', marginTop: 4, marginBottom: 24 }}>
            <a
              href="#"
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = '#f97316')}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)')}
            >
              Esqueci minha senha
            </a>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#c2590f' : '#f97316',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 15,
              borderRadius: 8,
              padding: 11,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.background = '#fb923c'
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.background = '#f97316'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar \u2192'
            )}
          </button>
        </form>
      </div>

      {/* Fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::placeholder { color: var(--text-muted) !important; }
      `}</style>
    </div>
  )
}
