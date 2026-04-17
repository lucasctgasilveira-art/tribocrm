import { useLocation, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'

// Post-signup confirmation screen. Reads the email to display from
// location.state.email (set by SignupPage when it navigates here).
// Falls back to a generic message if the user lands on this page
// directly — e.g. via refresh or bookmark.
export default function VerifyEmailSentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? ''

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '16px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
            <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
            <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
          </h1>
        </div>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '8px 0 32px' }}>
          Máquina de Vendas
        </p>

        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Mail size={34} color="#f97316" strokeWidth={1.5} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Verifique seu e-mail</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
          {email ? (
            <>Enviamos um link de confirmação para <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Clique no link para ativar sua conta.</>
          ) : (
            <>Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta.</>
          )}
        </p>

        <div style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, padding: '12px 14px', margin: '0 0 24px', display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
          <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 500, lineHeight: 1.5 }}>
            Você não conseguirá fazer login até verificar seu e-mail.
          </span>
        </div>

        <a
          href="/login"
          onClick={(e) => { e.preventDefault(); navigate('/login') }}
          style={{ display: 'inline-block', fontSize: 13, color: '#f97316', textDecoration: 'none', fontWeight: 500 }}
        >Voltar para o login</a>
      </div>
    </div>
  )
}
