import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import axios from 'axios'
import api from '../../services/api'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

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
  const [params] = useSearchParams()
  // Informational banner driven by ?msg= in the URL. For now only
  // `onboarding_done` is handled — emitted by OnboardingGestorPage
  // when the gestor finishes the wizard without a valid session.
  const flashMsg = params.get('msg')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' })
  // Unverified-email flow. When the backend replies 403
  // EMAIL_NOT_VERIFIED we surface the inline panel with a resend
  // button instead of the generic error toast — the user has no way
  // to fix this from outside the app.
  const [unverified, setUnverified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

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
    setUnverified(false)
    setResendSuccess(false)

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
    } catch (err: any) {
      const response = err?.response
      const status = response?.status
      const code = response?.data?.error?.code
      const message = response?.data?.error?.message
      // 403 EMAIL_NOT_VERIFIED comes from authMiddleware when the user
      // hits any authed endpoint before confirming their email. The
      // /auth/login endpoint itself is public, but once token is
      // issued the interceptor-less fetch here won't hit that path.
      // If the backend starts gating login directly with the same
      // code, we already handle it inline.
      if (status === 403 && code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true)
      } else {
        showError(message ?? 'E-mail ou senha incorretos.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      showError('Informe o e-mail antes de reenviar.')
      return
    }
    setResending(true)
    try {
      // Public endpoint — use raw axios to skip the JWT interceptor
      // and the auto-refresh/redirect-on-401 behavior in `api`.
      await axios.post(`${baseURL}/public/resend-verification`, { email: trimmed })
      setResendSuccess(true)
    } catch {
      // Backend always responds 200 for this flow; any failure here
      // is network-level. Still show the success state so we don't
      // leak signal about whether the email exists.
      setResendSuccess(true)
    } finally {
      setResending(false)
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
        {/* Flash banner — shown for post-flow handoffs like the gestor
            finishing the onboarding wizard while logged out. Placed
            inside the card so it sits above the logo without pushing
            the main form. */}
        {flashMsg === 'onboarding_done' && (
          <div style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#22c55e', marginBottom: 20, textAlign: 'center' }}>
            Conta configurada! Faça login para acessar seu sistema.
          </div>
        )}

        {/* Unverified-email panel. Rendered inline above the form so
            the user sees the explanation + resend action without any
            page navigation. Two states: initial warning (orange) and
            post-send confirmation (green). */}
        {unverified && !resendSuccess && (
          <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <AlertTriangle size={18} color="#f97316" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                Seu e-mail ainda não foi verificado.
              </div>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={{ width: '100%', background: resending ? '#c2590f' : '#f97316', color: '#fff', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: 10, border: 'none', cursor: resending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', opacity: resending ? 0.8 : 1 }}
            >
              {resending ? <><Loader2 size={14} className="animate-spin" />Enviando...</> : 'Reenviar e-mail de verificação'}
            </button>
          </div>
        )}
        {unverified && resendSuccess && (
          <div style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} color="#22c55e" strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#22c55e' }}>E-mail de verificação reenviado! Verifique sua caixa de entrada.</span>
          </div>
        )}

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
              href="/auth/forgot-password"
              onClick={(e) => { e.preventDefault(); navigate('/auth/forgot-password') }}
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
