import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { detectBrand, getCardToken } from '../../services/efiJs'

interface FormData {
  customer: { name: string; email: string; cpf: string }
  billingAddress: {
    street: string
    number: string
    neighborhood: string
    zipcode: string
    city: string
    state: string
    complement?: string
  }
  plan: {
    name: string
    cycle: string
    priceFormatted: string
    priceValue: number
  }
}

interface CardSubscriptionFormProps {
  onSuccess: (result: { subscriptionId: string; chargeId: string }) => void
  onCancel?: () => void
}

const MISSING_LABELS: Record<string, string> = {
  cpf: 'CPF',
  rua: 'Endereço (rua)',
  numero: 'Número',
  cep: 'CEP',
  cidade: 'Cidade',
  estado: 'Estado',
}

function maskCardNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function maskCpfDisplay(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length < 2) return '***.***.***-**'
  const tail = digits.slice(-2)
  return `***.***.***-${tail}`
}

function formatAddress(addr: FormData['billingAddress']): string {
  const complement = addr.complement ? ` — ${addr.complement}` : ''
  return `${addr.street}, ${addr.number}${complement}`
}

function formatCity(addr: FormData['billingAddress']): string {
  return `${addr.city}/${addr.state}`
}

function formatZip(zip: string): string {
  const digits = zip.replace(/\D/g, '')
  if (digits.length !== 8) return zip
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 500,
    margin: '0 auto',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 32,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    marginBottom: 12,
  },
  section: {
    paddingTop: 20,
    paddingBottom: 20,
    borderTop: '1px solid var(--border)',
  },
  firstSection: {
    paddingBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  readonlyValue: {
    fontSize: 14,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
  },
  readonlyLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginBottom: 2,
  },
  primaryBtn: {
    width: '100%',
    background: '#f97316',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtn: {
    width: '100%',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 24px',
    fontSize: 14,
    cursor: 'pointer',
  },
  spinner: {
    width: 14,
    height: 14,
    border: '2px solid #fff',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'card-sub-spin 0.8s linear infinite',
    display: 'inline-block',
  },
  brandBadge: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#f97316',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    marginTop: 6,
    textDecoration: 'underline',
  },
}

const SPINNER_KEYFRAMES = `@keyframes card-sub-spin { to { transform: rotate(360deg); } }`

export default function CardSubscriptionForm({ onSuccess, onCancel }: CardSubscriptionFormProps) {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData | null>(null)
  const [incompleteProfile, setIncompleteProfile] = useState<{ missing: string[] } | null>(null)

  const [cardNumber, setCardNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [expMonth, setExpMonth] = useState('')
  const [expYear, setExpYear] = useState('')
  const [cvv, setCvv] = useState('')
  const [brand, setBrand] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get('/payments/subscription-form-data')
      .then((res) => {
        if (cancelled) return
        const data = res?.data?.data as FormData | undefined
        if (!data) {
          setToast('Falha ao carregar dados')
          return
        }
        setFormData(data)
      })
      .catch((err: any) => {
        if (cancelled) return
        const code = err?.response?.data?.error?.code
        const details = err?.response?.data?.error?.details
        if (code === 'INCOMPLETE_PROFILE' && Array.isArray(details?.missing)) {
          setIncompleteProfile({ missing: details.missing })
          return
        }
        const msg = err?.response?.data?.error?.message ?? 'Falha ao carregar dados'
        setToast(msg)
        if (onCancel) setTimeout(() => onCancel(), 1500)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onCancel])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 6) {
      setBrand('')
      return
    }
    debounceRef.current = setTimeout(() => {
      detectBrand(digits)
        .then((b) => setBrand(b || ''))
        .catch(() => setBrand(''))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cardNumber])

  const handleCardNumberChange = useCallback((value: string) => {
    setCardNumber(maskCardNumber(value))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (submitting || !formData) return

    const digits = cardNumber.replace(/\D/g, '')
    if (!digits || digits.length < 13) {
      setToast('Número de cartão inválido')
      return
    }
    if (!cvv || cvv.length < 3) {
      setToast('CVV inválido')
      return
    }
    if (!expMonth || !expYear) {
      setToast('Validade inválida')
      return
    }
    if (!holderName.trim()) {
      setToast('Nome do titular obrigatório')
      return
    }

    setSubmitting(true)
    try {
      const normalizedYear = expYear.length === 2 ? `20${expYear}` : expYear
      const tokenResult = await getCardToken({
        number: digits,
        cvv,
        expMonth: expMonth.padStart(2, '0'),
        expYear: normalizedYear,
      })

      const response = await api.post('/payments/card-subscription', {
        paymentToken: tokenResult.token,
        billingAddress: formData.billingAddress,
        customer: {
          name: formData.customer.name,
          email: formData.customer.email,
          cpf: formData.customer.cpf,
        },
      })

      if (!response.data?.success) {
        throw new Error(response.data?.error?.message ?? 'Erro ao assinar')
      }

      setToast('Assinatura criada com sucesso!')
      setTimeout(() => {
        onSuccess({
          subscriptionId: response.data.data.subscriptionId,
          chargeId: response.data.data.chargeId,
        })
      }, 1200)
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        'Erro ao processar cartão'
      setToast(msg)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, formData, cardNumber, cvv, expMonth, expYear, holderName, onSuccess])

  const toastEl = toast ? (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        padding: '12px 20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: '4px solid #f97316',
        borderRadius: 8,
        fontSize: 13,
        color: 'var(--text-primary)',
        zIndex: 1001,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }}
    >
      {toast}
    </div>
  ) : null

  if (loading) {
    return (
      <>
        <style>{SPINNER_KEYFRAMES}</style>
        <div style={{ ...styles.container, textAlign: 'center', padding: 48 }}>
          <div
            style={{
              ...styles.spinner,
              borderColor: 'var(--border)',
              borderTopColor: 'transparent',
              width: 24,
              height: 24,
              margin: '0 auto 12px',
            }}
          />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Carregando dados da assinatura...
          </div>
        </div>
        {toastEl}
      </>
    )
  }

  if (incompleteProfile) {
    return (
      <>
        <div style={styles.container}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 12 }}>
            Complete seu perfil para continuar
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, marginBottom: 16, lineHeight: 1.5 }}>
            Pra contratar o cartão recorrente, precisamos dos seguintes dados:
          </p>
          <ul style={{ margin: 0, marginBottom: 24, paddingLeft: 20, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8 }}>
            {incompleteProfile.missing.map((key) => (
              <li key={key}>{MISSING_LABELS[key] ?? key}</li>
            ))}
          </ul>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate('/gestao/perfil')}
              style={styles.primaryBtn}
            >
              Completar perfil
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} style={styles.secondaryBtn}>
                Cancelar
              </button>
            )}
          </div>
        </div>
        {toastEl}
      </>
    )
  }

  if (!formData) {
    return (
      <>
        <div style={styles.container}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Não foi possível carregar os dados. Tente novamente.
          </p>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{ ...styles.secondaryBtn, marginTop: 16 }}>
              Fechar
            </button>
          )}
        </div>
        {toastEl}
      </>
    )
  }

  const submitLabel = submitting
    ? 'Processando...'
    : `Assinar por ${formData.plan.priceFormatted}${formData.plan.cycle === 'YEARLY' ? '/ano' : '/mês'}`

  return (
    <>
      <style>{SPINNER_KEYFRAMES}</style>
      <div style={styles.container}>
        {/* Seção 1 — Resumo do pedido */}
        <div style={styles.firstSection}>
          <div style={styles.sectionTitle}>Resumo do pedido</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {formData.plan.name} — {formData.plan.cycle === 'YEARLY' ? 'Anual' : 'Mensal'}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f97316', marginTop: 4 }}>
            {formData.plan.priceFormatted}
          </div>
        </div>

        {/* Seção 2 — Dados do titular */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Dados do titular</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={styles.readonlyLabel}>Nome</div>
              <div style={styles.readonlyValue}>{formData.customer.name}</div>
            </div>
            <div>
              <div style={styles.readonlyLabel}>E-mail</div>
              <div style={styles.readonlyValue}>{formData.customer.email}</div>
            </div>
            <div>
              <div style={styles.readonlyLabel}>CPF</div>
              <div style={styles.readonlyValue}>{maskCpfDisplay(formData.customer.cpf)}</div>
            </div>
          </div>
        </div>

        {/* Seção 3 — Endereço de cobrança */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Endereço de cobrança</div>
          <div style={styles.readonlyValue}>{formatAddress(formData.billingAddress)}</div>
          <div style={{ ...styles.readonlyValue, color: 'var(--text-secondary)' }}>
            {formData.billingAddress.neighborhood}
          </div>
          <div style={{ ...styles.readonlyValue, color: 'var(--text-secondary)' }}>
            {formatCity(formData.billingAddress)} — CEP {formatZip(formData.billingAddress.zipcode)}
          </div>
          <button
            type="button"
            onClick={() => navigate('/gestao/perfil')}
            style={styles.linkButton}
          >
            Editar no perfil →
          </button>
        </div>

        {/* Seção 4 — Dados do cartão */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Dados do cartão</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={styles.label}>Nome impresso no cartão</label>
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                onBlur={(e) => setHolderName(e.target.value.toUpperCase())}
                placeholder="COMO ESTÁ NO CARTÃO"
                disabled={submitting}
                style={styles.input}
                autoComplete="cc-name"
              />
            </div>

            <div style={{ position: 'relative' }}>
              <label style={styles.label}>Número do cartão</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                placeholder="0000 0000 0000 0000"
                disabled={submitting}
                style={styles.input}
                inputMode="numeric"
                autoComplete="cc-number"
              />
              {brand && <span style={{ ...styles.brandBadge, top: '70%' }}>{brand}</span>}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Validade</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="MM"
                    disabled={submitting}
                    style={{ ...styles.input, textAlign: 'center' }}
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                  />
                  <input
                    type="text"
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="AAAA"
                    disabled={submitting}
                    style={{ ...styles.input, textAlign: 'center' }}
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                  />
                </div>
              </div>
              <div style={{ width: 120 }}>
                <label style={styles.label}>CVV</label>
                <input
                  type="text"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="000"
                  disabled={submitting}
                  style={{ ...styles.input, textAlign: 'center' }}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Seção 5 — Botões */}
        <div style={{ ...styles.section, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...styles.primaryBtn,
              opacity: submitting ? 0.85 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting && <span style={styles.spinner} />}
            {submitLabel}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={submitting} style={styles.secondaryBtn}>
              Cancelar
            </button>
          )}
        </div>
      </div>
      {toastEl}
    </>
  )
}
