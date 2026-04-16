import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import axios from 'axios'
import { Loader2, Copy, Check, Zap, FileText, ExternalLink, LogIn } from 'lucide-react'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

type PlanKey = 'SOLO' | 'ESSENCIAL' | 'PRO' | 'ENTERPRISE'

interface PlanInfo {
  key: PlanKey
  name: string
  priceMonthly: number
  usersLabel: string
}

// Plan catalog duplicated from SignupPage. The public /payments/plans
// endpoint is behind the catch-all users router today, so a guest
// checkout would get 401 — cheaper to hardcode the 4 canonical plans
// here than to restructure the backend for this one screen.
const PLANS: Record<PlanKey, PlanInfo> = {
  SOLO:       { key: 'SOLO',       name: 'Solo',       priceMonthly: 69,  usersLabel: '1 usuário' },
  ESSENCIAL:  { key: 'ESSENCIAL',  name: 'Essencial',  priceMonthly: 197, usersLabel: 'até 3 usuários' },
  PRO:        { key: 'PRO',        name: 'Pro',        priceMonthly: 349, usersLabel: 'até 5 usuários' },
  ENTERPRISE: { key: 'ENTERPRISE', name: 'Enterprise', priceMonthly: 649, usersLabel: 'até 10 usuários' },
}

type Method = 'PIX' | 'BOLETO'

interface PixResult { txid: string; pixCopiaECola: string; qrCode: string; expiresAt: string }
interface BoletoResult { chargeId: string; boletoUrl: string; barCode: string; dueDate: string }

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function parsePlanKey(raw: string | null | undefined): PlanKey {
  const up = (raw ?? '').toString().toUpperCase()
  if (up === 'SOLO' || up === 'ESSENCIAL' || up === 'PRO' || up === 'ENTERPRISE') return up
  return 'ESSENCIAL'
}

function todayPlus3BusinessDays(): string {
  // Boleto vence em 3 dias úteis. Contagem simples: pula sábado/domingo.
  const d = new Date()
  let added = 0
  while (added < 3) {
    d.setDate(d.getDate() + 1)
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()

  // Plan resolution order: ?plano=... → location.state.plano → default ESSENCIAL
  const navPlan = (location.state as { plano?: string } | null)?.plano
  const planKey = parsePlanKey(params.get('plano') ?? navPlan ?? 'ESSENCIAL')
  const plan = PLANS[planKey]

  const [method, setMethod] = useState<Method>('PIX')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pixResult, setPixResult] = useState<PixResult | null>(null)
  const [boletoResult, setBoletoResult] = useState<BoletoResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasToken, setHasToken] = useState<boolean>(() => !!localStorage.getItem('accessToken'))

  // Re-check the token whenever the window regains focus — lets the
  // user log in in another tab and come back to the checkout without
  // needing to refresh.
  useEffect(() => {
    const onFocus = () => setHasToken(!!localStorage.getItem('accessToken'))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  async function generate() {
    setError('')
    setPixResult(null)
    setBoletoResult(null)
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setError('Você precisa fazer login para gerar a cobrança.')
      setHasToken(false)
      return
    }
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const description = `TriboCRM ${plan.name} — Mensal`
      if (method === 'PIX') {
        const { data } = await axios.post(
          `${baseURL}/payments/pix`,
          { value: plan.priceMonthly, description, expiresIn: 1800 },
          { headers },
        )
        if (data?.success) setPixResult(data.data as PixResult)
        else setError(data?.error?.message ?? 'Falha ao gerar PIX.')
      } else {
        const { data } = await axios.post(
          `${baseURL}/payments/boleto`,
          { value: plan.priceMonthly, description, dueDate: todayPlus3BusinessDays() },
          { headers },
        )
        if (data?.success) setBoletoResult(data.data as BoletoResult)
        else setError(data?.error?.message ?? 'Falha ao gerar boleto.')
      }
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.error?.message
      if (status === 401 || status === 403) {
        setError('Sua sessão expirou. Faça login novamente para continuar.')
        localStorage.removeItem('accessToken')
        setHasToken(false)
      } else {
        setError(msg ?? 'Erro de conexão ao gerar a cobrança.')
      }
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => { /* ignore */ })
  }

  // ── Styles ──
  const card: CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }
  const methodBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    textAlign: 'left',
    background: active ? 'rgba(249,115,22,0.08)' : 'var(--bg-surface)',
    border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
    borderRadius: 10,
    padding: '14px 16px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    transition: 'border-color 0.15s, background 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'var(--bg)', padding: '32px 16px' }}>
      <div style={{ ...card, width: '100%', maxWidth: 540 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
            <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
            <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
          </h1>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 24, marginTop: 8 }}>
          Máquina de Vendas
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 4px' }}>Ative sua conta</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 22px', lineHeight: 1.5 }}>
          Seu trial de 30 dias começa agora. O primeiro pagamento só será cobrado após 30 dias.
        </p>

        {/* Plan summary */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Plano escolhido</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{plan.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{plan.usersLabel}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f97316' }}>{fmtBRL(plan.priceMonthly)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/mês</div>
          </div>
        </div>

        {/* Payment methods */}
        {!pixResult && !boletoResult && hasToken && (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>Forma de pagamento</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button type="button" onClick={() => setMethod('PIX')} style={methodBtn(method === 'PIX')}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={18} color="#22c55e" strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>PIX</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aprovação imediata</div>
                </div>
              </button>
              <button type="button" onClick={() => setMethod('BOLETO')} style={methodBtn(method === 'BOLETO')}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={18} color="#3b82f6" strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Boleto</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vencimento em 3 dias úteis</div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={loading}
              style={{
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
              {loading ? <><Loader2 size={18} className="animate-spin" />Gerando...</> : (method === 'PIX' ? 'Gerar PIX' : 'Gerar Boleto')}
            </button>
          </>
        )}

        {/* Auth-required fallback */}
        {!hasToken && (
          <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <LogIn size={20} color="#f97316" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Clique em Ir para login e conheça o sistema</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Faça login com o e-mail e senha que você usou no cadastro para iniciar a construção da sua Máquina de Vendas com 30 dias grátis.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{ width: '100%', background: '#f97316', color: '#fff', fontWeight: 600, fontSize: 14, borderRadius: 8, padding: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >Ir para login</button>
          </div>
        )}

        {/* PIX result */}
        {pixResult && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>PIX gerado com sucesso</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Abra o app do seu banco e use o código copia-e-cola abaixo para finalizar o pagamento.</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Código PIX copia-e-cola</div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 10, maxHeight: 110, overflowY: 'auto' }}>
              {pixResult.pixCopiaECola || '(código não disponível — tente novamente)'}
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(pixResult.pixCopiaECola)}
              disabled={!pixResult.pixCopiaECola}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: copied ? '#22c55e' : '#f97316', color: '#fff', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: 10, border: 'none', cursor: pixResult.pixCopiaECola ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'background 0.2s' }}
            >
              {copied ? <><Check size={14} strokeWidth={2} /> Copiado!</> : <><Copy size={14} strokeWidth={1.5} /> Copiar código</>}
            </button>
          </div>
        )}

        {/* Boleto result */}
        {boletoResult && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', marginBottom: 4 }}>Boleto gerado com sucesso</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vencimento: {new Date(boletoResult.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
            </div>
            {boletoResult.boletoUrl && (
              <a
                href={boletoResult.boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f97316', color: '#fff', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: 10, textDecoration: 'none', fontFamily: 'inherit', marginBottom: 10 }}
              >
                <ExternalLink size={14} strokeWidth={1.5} /> Abrir boleto (PDF)
              </a>
            )}
            {boletoResult.barCode && (
              <>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Código de barras</div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 10 }}>
                  {boletoResult.barCode}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(boletoResult.barCode)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: copied ? '#22c55e' : 'transparent', color: copied ? '#fff' : 'var(--text-secondary)', fontWeight: 500, fontSize: 12, borderRadius: 8, padding: 8, border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  {copied ? <><Check size={14} strokeWidth={2} /> Copiado!</> : <><Copy size={13} strokeWidth={1.5} /> Copiar código de barras</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* Confirmation note */}
        {(pixResult || boletoResult) && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, marginBottom: 16 }}>
            Após confirmar o pagamento, sua conta será ativada automaticamente.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 10, fontSize: 12, color: '#ef4444', marginTop: 12 }}>
            {error}
          </div>
        )}

        {/* Annual discount upsell — replaces the previous "Pular por
            agora" link. Highlighted in green so the offer reads as a
            distinct opportunity, not a fallback. The button forwards
            to /login with a redirect param so the user lands on the
            subscription page right after authenticating. */}
        <div style={{ marginTop: 20, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>Garantir desconto de 15% no plano anual</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
            Pular teste grátis e garantir meu desconto de 15% pagando o valor anual.
          </div>
          <button
            type="button"
            onClick={() => navigate('/login?redirect=/gestao/assinatura')}
            style={{ width: '100%', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, borderRadius: 8, padding: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#16a34a' }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#22c55e' }}
          >Quero o plano anual com desconto →</button>
        </div>
      </div>

      <style>{`::placeholder { color: var(--text-muted) !important; }`}</style>
    </div>
  )
}
