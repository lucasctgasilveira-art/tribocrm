import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

// Public page hit by the link the backend sends after POST /public/signup.
// We bypass the `api` axios instance because it auto-attaches the
// user's JWT; at verification time the user hasn't logged in yet.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

type Status = 'loading' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')?.trim() ?? ''
    if (!token) {
      setStatus('error')
      setMessage('Link inválido. Token não encontrado.')
      return
    }

    let cancelled = false
    axios
      .get(`${baseURL}/public/verify-email`, { params: { token } })
      .then((res) => {
        if (cancelled) return
        const d = res.data?.data
        if (res.data?.success) {
          setStatus('success')
          setMessage('E-mail confirmado! Entrando automaticamente...')

          // The backend now returns accessToken + refreshToken +
          // user snapshot alongside the verification response. Save
          // them to localStorage so the auto-login page (and
          // subsequent protected routes) pick up the session without
          // the user having to type their password again.
          if (d?.accessToken) localStorage.setItem('accessToken', d.accessToken)
          if (d?.refreshToken) localStorage.setItem('refreshToken', d.refreshToken)
          if (d?.user) localStorage.setItem('user', JSON.stringify(d.user))

          // Store plano/ciclo from the backend response (derived from
          // the tenant's real planCycle + plan.slug). Falls back to
          // the localStorage values the SignupPage saved earlier — in
          // case the user verified from the same browser.
          const plano = d?.plano ?? localStorage.getItem('signup_plano') ?? 'essencial'
          const ciclo = d?.ciclo ?? localStorage.getItem('signup_ciclo') ?? 'mensal'
          localStorage.removeItem('signup_plano')
          localStorage.removeItem('signup_ciclo')

          // Redirect via a lightweight page that stores the session
          // and hands off to /checkout with the right query params.
          setTimeout(() => {
            navigate(`/auth/auto-login?plano=${encodeURIComponent(plano)}&ciclo=${encodeURIComponent(ciclo)}`, { replace: true })
          }, 2000)
        } else {
          setStatus('error')
          setMessage(res.data?.error?.message ?? 'Não foi possível confirmar seu e-mail.')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setMessage(err?.response?.data?.error?.message ?? 'Link inválido ou expirado.')
      })

    return () => { cancelled = true }
  }, [params, navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111318', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#1a1d24', border: '1px solid #2a2d35', borderRadius: 16, padding: 40, textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316', marginBottom: 24 }}>TriboCRM</div>

        {status === 'loading' && (
          <>
            <Loader2 size={36} color="#f97316" strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f3f4f6', marginBottom: 6 }}>Confirmando seu e-mail...</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>Isso leva só alguns segundos.</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={34} color="#22c55e" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f3f4f6', marginBottom: 6 }}>E-mail confirmado!</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>{message}</div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <XCircle size={34} color="#ef4444" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f3f4f6', marginBottom: 6 }}>Falha na confirmação</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>{message}</div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Ir para login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
