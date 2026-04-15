import { useState, type FormEvent, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Eye, EyeOff, Loader2, XCircle, Check } from 'lucide-react'

// Public signup screen. Uses the `axios` default (not the shared api
// instance) because the interceptor on `api` attaches the JWT and
// triggers a refresh/redirect on 401 — neither applies before the
// user even has an account. Hits the backend directly via VITE_API_URL.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

type PlanKey = 'SOLO' | 'ESSENCIAL' | 'PRO' | 'ENTERPRISE'

interface PlanInfo {
  key: PlanKey
  name: string
  priceMonthly: number
  usersLabel: string
  badge?: string
}

const PLANS: PlanInfo[] = [
  { key: 'SOLO', name: 'Solo', priceMonthly: 69, usersLabel: '1 usuário' },
  { key: 'ESSENCIAL', name: 'Essencial', priceMonthly: 197, usersLabel: 'até 3 usuários' },
  { key: 'PRO', name: 'Pro', priceMonthly: 349, usersLabel: 'até 5 usuários', badge: 'Mais Popular' },
  { key: 'ENTERPRISE', name: 'Enterprise', priceMonthly: 649, usersLabel: 'até 10 usuários' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function maskPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return '(' + digits
  if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2)
  if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6)
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7)
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

const inputStyle: CSSProperties = {
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

export default function SignupPage() {
  const navigate = useNavigate()

  const [plan, setPlan] = useState<PlanKey>('ESSENCIAL')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function validate(): string | null {
    if (!name.trim()) return 'Informe seu nome completo.'
    if (!EMAIL_RE.test(email.trim())) return 'E-mail inválido.'
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) return 'Informe um WhatsApp válido.'
    if (!companyName.trim()) return 'Informe o nome da empresa.'
    if (password.length < 8) return 'A senha deve ter no mínimo 8 caracteres.'
    if (password !== confirmPassword) return 'As senhas não coincidem.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    try {
      const { data } = await axios.post(`${baseURL}/public/signup`, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        companyName: companyName.trim(),
        planId: plan,
      })

      if (data?.success) {
        navigate('/auth/verify-email-sent', {
          replace: true,
          state: { email: email.trim().toLowerCase() },
        })
      } else {
        setError(data?.error?.message ?? 'Não foi possível criar sua conta.')
      }
    } catch (e: any) {
      const status = e?.response?.status
      const apiMsg = e?.response?.data?.error?.message
      if (status === 409) {
        setError('Este e-mail já está cadastrado. Faça login ou use outro e-mail.')
      } else if (apiMsg) {
        setError(apiMsg)
      } else {
        setError('Erro de conexão com o servidor.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'var(--bg)', padding: '32px 16px' }}>
      {error && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', borderLeft: '4px solid #ef4444', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: 420 }}>
          <XCircle size={18} color="#ef4444" strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{error}</span>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
            <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
            <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
          </h1>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 24, marginTop: 8 }}>
          Máquina de Vendas
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 4px' }}>Criar sua conta</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 24px' }}>30 dias grátis · Sem cartão de crédito</p>

        {/* Plan selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
          {PLANS.map(p => {
            const active = plan === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlan(p.key)}
                style={{
                  textAlign: 'left',
                  background: active ? 'rgba(249,115,22,0.08)' : 'var(--bg-surface)',
                  border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'border-color 0.15s, background 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {p.badge && (
                  <span style={{ position: 'absolute', top: -8, right: 10, background: '#f97316', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{p.badge}</span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                  {active && (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#f97316', fontWeight: 700 }}>{fmtBRL(p.priceMonthly)}<span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>/mês</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.usersLabel}</div>
              </button>
            )
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Nome completo</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="João da Silva" required autoComplete="name" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>WhatsApp</label>
                <input type="tel" value={phone} onChange={e => setPhone(maskPhoneBR(e.target.value))} placeholder="(00) 00000-0000" required inputMode="tel" maxLength={15} autoComplete="tel" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Nome da empresa</label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Sua empresa Ltda" required autoComplete="organization" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} autoComplete="new-password" style={{ ...inputStyle, paddingRight: 44 }} onFocus={focusOn} onBlur={focusOff} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <Eye size={18} color="var(--text-muted)" strokeWidth={1.5} /> : <EyeOff size={18} color="var(--text-muted)" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Confirmar senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" required minLength={8} autoComplete="new-password" style={{ ...inputStyle, paddingRight: 44 }} onFocus={focusOn} onBlur={focusOff} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showConfirm ? <Eye size={18} color="var(--text-muted)" strokeWidth={1.5} /> : <EyeOff size={18} color="var(--text-muted)" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 24,
              width: '100%',
              background: loading ? '#c2590f' : '#f97316',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              borderRadius: 8,
              padding: 12,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#fb923c' }}
            onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#f97316' }}
          >
            {loading ? (<><Loader2 size={18} className="animate-spin" />Criando conta...</>) : 'Criar minha conta grátis \u2192'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Já tem conta?{' '}
          <a
            href="/login"
            onClick={(e) => { e.preventDefault(); navigate('/login') }}
            style={{ color: '#f97316', textDecoration: 'none', fontWeight: 500 }}
          >Entrar</a>
        </div>
      </div>

      <style>{`::placeholder { color: var(--text-muted) !important; }`}</style>
    </div>
  )
}
