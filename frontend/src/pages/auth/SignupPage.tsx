import { useState, useEffect, useMemo, type FormEvent, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Eye, EyeOff, Loader2, XCircle, Check, Zap, FileText, CreditCard } from 'lucide-react'
import WhatsAppFAB from '../../components/WhatsAppFAB'
import { validateDocument, formatDocument, stripDocument } from '../../utils/validateDocument'

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
  // Effective monthly price when paid annually (already with 15% off).
  // Used for display only — the actual single-payment value lives in
  // CheckoutPage's PLANS map (priceYearly).
  monthEquivalent: number
  usersLabel: string
  badge?: string
}

const PLANS: PlanInfo[] = [
  { key: 'SOLO',       name: 'Solo',       priceMonthly: 69,  monthEquivalent: 59,  usersLabel: '1 usuário' },
  { key: 'ESSENCIAL',  name: 'Essencial',  priceMonthly: 197, monthEquivalent: 167, usersLabel: 'até 3 usuários' },
  { key: 'PRO',        name: 'Pro',        priceMonthly: 349, monthEquivalent: 297, usersLabel: 'até 5 usuários', badge: 'Mais Popular' },
  { key: 'ENTERPRISE', name: 'Enterprise', priceMonthly: 649, monthEquivalent: 552, usersLabel: 'até 10 usuários' },
]

type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD'

// Visual config for the 3 payment-method cards. Lucide icons + colors
// match what CheckoutPage shows in the authenticated billing flow so
// the user sees the same vocabulary on both screens.
const PAYMENT_OPTIONS = [
  { value: 'PIX' as const,         label: 'PIX',     desc: 'Aprovação imediata',     Icon: Zap,        color: '#22c55e' },
  { value: 'BOLETO' as const,      label: 'Boleto',  desc: 'Vence em 3 dias úteis',  Icon: FileText,   color: '#3b82f6' },
  { value: 'CREDIT_CARD' as const, label: 'Cartão',  desc: 'Débito automático',      Icon: CreditCard, color: '#a855f7' },
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

// Payload persisted to sessionStorage between /signup?step=1 and
// ?step=2. Password is deliberately NOT stored — if the user refreshes
// on step 2, the password field is empty on return to step 1 and
// they must retype it (security-over-convenience).
interface Step1Data {
  name: string
  email: string
  phone: string
  companyName: string
  plan: PlanKey
  ciclo: 'mensal' | 'anual'
}

const STEP1_STORAGE_KEY = 'signup_step1_data'

function readStep1Data(): Step1Data | null {
  try {
    const raw = sessionStorage.getItem(STEP1_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Step1Data>
    // Minimal shape check — if it's malformed, treat as absent so the
    // step 2 guard forces the user back to step 1 instead of crashing.
    if (typeof parsed?.name !== 'string' || typeof parsed?.email !== 'string') return null
    return parsed as Step1Data
  } catch { return null }
}

// Step 2 fields land here as the user fills them across sub-etapas
// 5B-5G. Each field is optional so the partial state mid-flow is
// representable. Sub-etapa 5G's handleFinishSignup will read this
// once at submit time.
interface Step2Data {
  paymentMethod?: PaymentMethod
  // Persisted formatted (e.g. "123.456.789-09" / "12.345.678/0001-95").
  // Empty string is never stored — the field is removed from the
  // object when cleared so readStep2Data stays truthful about state.
  document?: string
}

const STEP2_STORAGE_KEY = 'signup_step2_data'

function readStep2Data(): Step2Data | null {
  try {
    const raw = sessionStorage.getItem(STEP2_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Step2Data>
    // Validate paymentMethod is one of the known values; if it was
    // tampered with, return an empty object so future writes start
    // from a clean slate instead of crashing the radio group.
    if (parsed?.paymentMethod && parsed.paymentMethod !== 'PIX' && parsed.paymentMethod !== 'BOLETO' && parsed.paymentMethod !== 'CREDIT_CARD') {
      return {}
    }
    return parsed as Step2Data
  } catch { return null }
}

export default function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Derived from URL — reactive via React Router, so browser back/
  // forward buttons just work.
  const step: 1 | 2 = params.get('step') === '2' ? 2 : 1

  // Read plano + ciclo from URL once on mount and persist to
  // localStorage. The user is about to leave the app to click the
  // verification link in their email — neither URL params nor router
  // state survive that round-trip, so localStorage is the only carrier
  // that gets us back to /checkout with the right plan + cycle. The
  // VerifyEmailPage reads (and clears) these on its way to /checkout.
  const initialParams = new URLSearchParams(window.location.search)
  const initialPlano = initialParams.get('plano')?.toLowerCase() ?? 'essencial'
  const initialCiclo = initialParams.get('ciclo')?.toLowerCase() ?? 'mensal'
  // Pre-fill personal fields when the landing page pop-up already
  // collected them. Stored in localStorage alongside plano/ciclo so
  // the verify-email round-trip can restore context if needed.
  const nomeParam = initialParams.get('nome') ?? ''
  const emailParam = initialParams.get('email') ?? ''
  const telefoneParam = initialParams.get('telefone') ?? ''
  const empresaParam = initialParams.get('empresa') ?? ''
  localStorage.setItem('signup_plano', initialPlano)
  localStorage.setItem('signup_ciclo', initialCiclo === 'anual' ? 'anual' : 'mensal')
  localStorage.setItem('signup_nome', nomeParam)
  localStorage.setItem('signup_email', emailParam)
  localStorage.setItem('signup_telefone', telefoneParam)
  localStorage.setItem('signup_empresa', empresaParam)
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>(() => (initialCiclo === 'anual' ? 'anual' : 'mensal'))

  function handleCycleChange(novo: 'mensal' | 'anual') {
    setCiclo(novo)
    // Persist so the verify-email round-trip fallback (AutoLoginPage /
    // VerifyEmailPage reading from localStorage when the user clicks
    // the verification link in another browser) stays in sync.
    localStorage.setItem('signup_ciclo', novo)
  }

  const [plan, setPlan] = useState<PlanKey>(() => {
    if (initialPlano === 'solo') return 'SOLO'
    if (initialPlano === 'essencial') return 'ESSENCIAL'
    if (initialPlano === 'pro') return 'PRO'
    if (initialPlano === 'enterprise') return 'ENTERPRISE'
    return 'ESSENCIAL'
  })
  const [name, setName] = useState(nomeParam)
  const [email, setEmail] = useState(emailParam)
  const [phone, setPhone] = useState(telefoneParam ? maskPhoneBR(telefoneParam) : '')
  const [companyName, setCompanyName] = useState(empresaParam)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 2 — payment method. Hydrated from sessionStorage so it
  // survives back/forward navigation and refresh on /signup?step=2.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => readStep2Data()?.paymentMethod ?? 'PIX')

  function handlePaymentMethodChange(method: PaymentMethod) {
    setPaymentMethod(method)
    try {
      // Merge instead of overwrite — future sub-etapas will add
      // document/zipCode/address/terms to the same object.
      const current = readStep2Data()
      const next: Step2Data = { ...(current ?? {}), paymentMethod: method }
      sessionStorage.setItem(STEP2_STORAGE_KEY, JSON.stringify(next))
    } catch { /* sessionStorage may be disabled (private mode); UI still works */ }
  }

  // Step 2 — CPF/CNPJ field. `documentValue` stores the masked string
  // as the user types; the raw digits are derived on demand via
  // stripDocument. `documentTouched` gates the error-state styling so
  // the red border only appears after the first blur.
  const [documentValue, setDocumentValue] = useState<string>(() => readStep2Data()?.document ?? '')
  const [documentTouched, setDocumentTouched] = useState<boolean>(false)

  const documentValidation = useMemo(() => {
    const digits = stripDocument(documentValue)
    if (digits.length !== 11 && digits.length !== 14) {
      // Neither a complete CPF nor a complete CNPJ — no red flag yet,
      // user is still typing.
      return { valid: false, checked: false }
    }
    return { valid: validateDocument(digits).valid, checked: true }
  }, [documentValue])

  function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = stripDocument(e.target.value).slice(0, 14)
    const formatted = formatDocument(raw)
    setDocumentValue(formatted)
    try {
      const current = readStep2Data() ?? {}
      if (raw.length === 0) {
        // Drop the key entirely so the object never carries an empty
        // string — keeps readStep2Data checks honest.
        const { document: _removed, ...rest } = current
        sessionStorage.setItem(STEP2_STORAGE_KEY, JSON.stringify(rest))
      } else {
        const next: Step2Data = { ...current, document: formatted }
        sessionStorage.setItem(STEP2_STORAGE_KEY, JSON.stringify(next))
      }
    } catch { /* private mode / storage disabled */ }
  }

  function handleDocumentBlur() {
    setDocumentTouched(true)
  }

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

  // Hydration: if the user is returning to step 1 from step 2 (or
  // reopened /signup?step=2 directly), restore their previously typed
  // data. sessionStorage has precedence over the URL query params so
  // edits survive the round-trip.
  useEffect(() => {
    const stored = readStep1Data()
    if (!stored) return
    setName(stored.name)
    setEmail(stored.email)
    setPhone(stored.phone)
    setCompanyName(stored.companyName)
    setPlan(stored.plan)
    setCiclo(stored.ciclo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guard: direct access to /signup?step=2 without step 1 data bounces
  // back to step 1. Runs whenever step changes so a user who types the
  // URL by hand lands in the right place.
  useEffect(() => {
    if (step === 2 && !readStep1Data()) {
      navigate('/signup?step=1', { replace: true })
    }
  }, [step, navigate])

  // Advance to step 2 — validates, persists the form snapshot (sans
  // password) and navigates. Does NOT hit POST /public/signup; that
  // only happens from step 2's "Finalizar cadastro" button.
  function handleContinueStep1(e: FormEvent) {
    e.preventDefault()
    setError('')

    const err = validate()
    if (err) { setError(err); return }

    const snapshot: Step1Data = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      companyName: companyName.trim(),
      plan,
      ciclo,
    }
    sessionStorage.setItem(STEP1_STORAGE_KEY, JSON.stringify(snapshot))
    navigate('/signup?step=2')
  }

  // Final signup POST — reached from step 2's "Finalizar cadastro"
  // button. Disabled until the billing fields land in a later
  // sub-etapa; the handler stays wired so flipping disabled=false
  // completes the flow.
  async function handleFinishSignup() {
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
        // Cycle flows through to the backend tenant.planCycle so the
        // PIX/Boleto webhook extends planExpiresAt by the right number
        // of days (30 for MONTHLY, 365 for YEARLY).
        planCycle: ciclo === 'anual' ? 'YEARLY' : 'MONTHLY',
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
        <p style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 20, marginTop: 8 }}>
          Máquina de Vendas
        </p>

        {/* Progress indicator — "Passo X de 2" */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: step === 1 ? '#f97316' : 'transparent', border: step === 1 ? 'none' : '2px solid var(--border)', boxSizing: 'border-box' }} />
            <span style={{ width: 40, height: 2, background: 'var(--border)' }} />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: step === 2 ? '#f97316' : 'transparent', border: step === 2 ? 'none' : '2px solid var(--border)', boxSizing: 'border-box' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Passo {step} de 2</span>
        </div>

        {step === 1 ? (
        <>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 4px' }}>Criar sua conta</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 24px' }}>
          {ciclo === 'anual' ? 'Plano anual com 15% de desconto · Pagamento único' : '30 dias grátis · Sem cartão de crédito'}
        </p>

        {/* Cycle toggle — Mensal | [switch] | Anual + 15% OFF badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => handleCycleChange('mensal')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 13, fontWeight: ciclo === 'mensal' ? 600 : 400, color: ciclo === 'mensal' ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.2s' }}
          >
            Mensal
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={ciclo === 'anual'}
            aria-label="Alternar entre cobrança mensal e anual"
            onClick={() => handleCycleChange(ciclo === 'anual' ? 'mensal' : 'anual')}
            style={{ position: 'relative', width: 48, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0, background: ciclo === 'anual' ? '#f97316' : 'var(--border)', transition: 'background 0.2s' }}
          >
            <span style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: ciclo === 'anual' ? 'translateX(24px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
          </button>
          <button
            type="button"
            onClick={() => handleCycleChange('anual')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 13, fontWeight: ciclo === 'anual' ? 600 : 400, color: ciclo === 'anual' ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.2s' }}
          >
            Anual
          </button>
          <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            15% OFF
          </span>
        </div>

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
                {ciclo === 'anual' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    {fmtBRL(p.priceMonthly)}/mês
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: '#f97316', fontWeight: 700 }}>
                    {fmtBRL(ciclo === 'anual' ? p.monthEquivalent : p.priceMonthly)}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>/mês</span>
                  </div>
                  {ciclo === 'anual' && (
                    <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>15% OFF</span>
                  )}
                </div>
                {ciclo === 'anual' && (
                  <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>
                    Economia de {fmtBRL((p.priceMonthly - p.monthEquivalent) * 12)}/ano
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.usersLabel}</div>
              </button>
            )
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleContinueStep1}>
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
            {loading ? (<><Loader2 size={18} className="animate-spin" />Criando conta...</>) : 'Continuar \u2192'}
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
        </>
        ) : (
        <>
        {/* Step 2 — billing placeholder */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 4px' }}>Dados de cobrança</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 24px' }}>
          Quase lá! Falta preencher os dados para ativar seu trial.
        </p>

        {/* Snapshot of the data collected in step 1 — password is
            deliberately absent. */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Plano', value: `${PLANS.find(p => p.key === plan)?.name ?? plan} (${ciclo === 'anual' ? 'Anual' : 'Mensal'})` },
            { label: 'Nome', value: name },
            { label: 'E-mail', value: email },
            { label: 'WhatsApp', value: phone },
            { label: 'Empresa', value: companyName },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80 }}>{row.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Payment method selector — sub-etapa 5B. The choice is
            persisted to sessionStorage but not yet sent on the POST;
            sub-etapa 5G's handleFinishSignup will pick it up. */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
            Como você prefere pagar após 30 dias?
          </label>
          <div role="radiogroup" aria-label="Método de pagamento" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {PAYMENT_OPTIONS.map(opt => {
              const active = paymentMethod === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handlePaymentMethodChange(opt.value)}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'
                      e.currentTarget.style.background = 'rgba(249,115,22,0.04)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                  style={{
                    padding: '14px 12px',
                    borderRadius: 10,
                    border: active ? '1.5px solid #f97316' : '1px solid var(--border)',
                    background: active ? 'rgba(249,115,22,0.10)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                  }}
                >
                  <opt.Icon size={22} color={opt.color} strokeWidth={1.8} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</span>
                </button>
              )
            })}
          </div>
          {paymentMethod === 'CREDIT_CARD' && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: 'rgba(59,130,246,0.10)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              ℹ️ Enviaremos o link para cadastrar seu cartão 7 dias antes do fim do trial.
            </div>
          )}
        </div>

        {/* CPF/CNPJ field — sub-etapa 5C. Dynamic mask (CPF ≤11
            digits, CNPJ 12-14). Validated on blur; green border when
            valid, red when touched-and-invalid. Persisted formatted
            to sessionStorage via the step2_data key. */}
        <div style={{ marginTop: 20 }}>
          <label htmlFor="signup-document" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
            CPF ou CNPJ <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="signup-document"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={18}
            value={documentValue}
            onChange={handleDocumentChange}
            onBlur={(e) => { focusOff(e); handleDocumentBlur() }}
            onFocus={focusOn}
            placeholder={stripDocument(documentValue).length > 11 ? '00.000.000/0000-00' : '000.000.000-00'}
            aria-invalid={documentTouched && documentValidation.checked && !documentValidation.valid}
            style={{
              ...inputStyle,
              borderColor: (documentTouched && documentValidation.checked && !documentValidation.valid)
                ? '#ef4444'
                : (documentValidation.checked && documentValidation.valid)
                  ? '#22c55e'
                  : 'var(--border)',
            }}
          />
          {documentTouched && documentValidation.checked && !documentValidation.valid && (
            <p style={{ marginTop: 6, fontSize: 13, color: '#ef4444' }}>
              CPF ou CNPJ inválido. Verifique os dígitos.
            </p>
          )}
          {!documentTouched && stripDocument(documentValue).length > 0 && stripDocument(documentValue).length < 11 && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              Digite seu CPF (11 dígitos) ou CNPJ (14 dígitos)
            </p>
          )}
        </div>

        {/* Under-construction notice for the fields that will land in
            subsequent sub-etapas (address, terms acceptance). */}
        <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.30)', borderRadius: 10, padding: '12px 14px', marginTop: 20, marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          🚧 <strong style={{ color: '#f97316' }}>Em construção</strong> — Os campos de endereço e aceite de termos aparecerão aqui nas próximas etapas.
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/signup?step=1')}
            style={{ flex: '0 0 auto', background: 'none', color: 'var(--text-muted)', fontWeight: 500, fontSize: 14, borderRadius: 8, padding: '10px 16px', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            &larr; Voltar
          </button>
          <button
            type="button"
            disabled
            title="Em construção"
            onClick={handleFinishSignup}
            style={{ flex: 1, background: '#f97316', color: '#fff', fontWeight: 600, fontSize: 15, borderRadius: 8, padding: 12, border: 'none', cursor: 'not-allowed', opacity: 0.5, fontFamily: 'inherit' }}
          >
            Finalizar cadastro
          </button>
        </div>
        </>
        )}
      </div>

      <style>{`::placeholder { color: var(--text-muted) !important; }`}</style>

      {/* Floating WhatsApp button — passes current form state down so
          the popover arrives pre-filled when the gestor has already
          started typing (or came from a pop-up link with nome/email/
          telefone in the URL). */}
      <WhatsAppFAB name={name} email={email} phone={phone} />
    </div>
  )
}
