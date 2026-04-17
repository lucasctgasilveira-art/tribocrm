import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Lightweight trampoline page that converts URL-carried tokens into a
// proper localStorage session and then bounces the user to /checkout
// (or another target). Reached via the email-verification flow: the
// VerifyEmailPage calls GET /public/verify-email, receives JWT tokens
// in the response, saves them to localStorage, and navigates here
// with ?plano= and ?ciclo= so the checkout pre-selects the plan.
//
// In the rare case the tokens weren't already stored by VerifyEmail
// (e.g. the user opened the verify link in another browser), we also
// accept ?token= and ?refresh= in the URL as a fallback. This keeps
// the page self-contained without relying on cross-page state.

export default function AutoLoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    // If tokens came via URL (fallback for cross-browser verify links),
    // persist them now. VerifyEmailPage already saved them in the happy
    // path, but this covers edge cases where it didn't.
    const urlToken = params.get('token')
    const urlRefresh = params.get('refresh')
    if (urlToken && !localStorage.getItem('accessToken')) {
      localStorage.setItem('accessToken', urlToken)
    }
    if (urlRefresh && !localStorage.getItem('refreshToken')) {
      localStorage.setItem('refreshToken', urlRefresh)
    }

    // Build the checkout destination with the plan + cycle params the
    // caller forwarded. Falls back to localStorage values set by the
    // SignupPage (same-browser path), then to safe defaults.
    const plano = params.get('plano') ?? localStorage.getItem('signup_plano') ?? 'essencial'
    const ciclo = params.get('ciclo') ?? localStorage.getItem('signup_ciclo') ?? 'mensal'
    localStorage.removeItem('signup_plano')
    localStorage.removeItem('signup_ciclo')

    // Small delay so the user sees "Entrando automaticamente..." — the
    // bounce is instant on fast connections and the spinner prevents the
    // feeling of a blank flash.
    const t = setTimeout(() => {
      navigate(`/checkout?plano=${encodeURIComponent(plano)}&ciclo=${encodeURIComponent(ciclo)}`, { replace: true })
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111318', padding: 20 }}>
      <div style={{ textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316', marginBottom: 24 }}>TriboCRM</div>
        <Loader2 size={32} color="#f97316" strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#f3f4f6', marginBottom: 6 }}>Entrando automaticamente...</div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Você será redirecionado em instantes.</div>
      </div>
    </div>
  )
}
