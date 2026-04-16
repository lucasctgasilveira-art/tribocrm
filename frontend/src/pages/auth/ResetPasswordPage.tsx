import { useEffect, useState, type FormEvent, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

const inputStyle: CSSProperties = {
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
  fontFamily: 'inherit',
}

function focusOn(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#f97316'
  e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
}
function focusOff(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => navigate('/login', { replace: true }), 3000)
    return () => clearTimeout(t)
  }, [done, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) { setError('Link inválido: token ausente na URL.'); return }
    if (password.length < 8) { setError('A senha deve ter no mínimo 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)
    try {
      const { data } = await axios.post(`${baseURL}/public/reset-password`, { token, password })
      if (data?.success) {
        setDone(true)
      } else {
        setError(data?.error?.message ?? 'Não foi possível redefinir sua senha.')
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Link inválido ou expirado. Solicite um novo link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
            <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
            <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
          </h1>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 28, marginTop: 8 }}>
          Máquina de Vendas
        </p>

        {done ? (
          <>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={34} color="#22c55e" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 10px' }}>Senha alterada com sucesso!</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
              Redirecionando para o login...
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 4px' }}>Nova senha</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 22px', lineHeight: 1.5 }}>
              Escolha uma senha nova para sua conta.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Nova senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} autoComplete="new-password" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <Eye size={18} color="var(--text-muted)" strokeWidth={1.5} /> : <EyeOff size={18} color="var(--text-muted)" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 4 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Confirmar nova senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a senha" required minLength={8} autoComplete="new-password" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showConfirm ? <Eye size={18} color="var(--text-muted)" strokeWidth={1.5} /> : <EyeOff size={18} color="var(--text-muted)" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 12 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', marginTop: 18,
                  background: loading ? '#c2590f' : '#f97316', color: '#fff',
                  fontWeight: 600, fontSize: 15, borderRadius: 8, padding: 11,
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#fb923c' }}
                onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#f97316' }}
              >
                {loading ? <><Loader2 size={18} className="animate-spin" />Redefinindo...</> : 'Redefinir senha'}
              </button>
            </form>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
          <a
            href="/login"
            onClick={(e) => { e.preventDefault(); navigate('/login') }}
            style={{ color: '#f97316', textDecoration: 'none', fontWeight: 500 }}
          >Voltar para o login</a>
        </div>
      </div>

      <style>{`::placeholder { color: var(--text-muted) !important; }`}</style>
    </div>
  )
}
