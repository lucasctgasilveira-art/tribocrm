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
        if (res.data?.success) {
          setStatus('success')
          setMessage('E-mail confirmado! Redirecionando...')
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
  }, [params])

  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(() => navigate('/login', { replace: true }), 3000)
    return () => clearTimeout(t)
  }, [status, navigate])

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
