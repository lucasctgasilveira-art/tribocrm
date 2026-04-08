import { useState, useEffect } from 'react'
import { X, Loader2, QrCode, FileText } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../services/api'

type Method = 'PIX' | 'BOLETO'
type Cycle = 'MONTHLY' | 'YEARLY'
type DiscType = 'PERCENT' | 'FIXED'

interface Plan {
  id: string
  name: string
  priceMonthly: number | string
  priceYearly: number | string
}

interface RetryProps {
  mode: 'retry'
  charge: {
    id: string
    amount: string | number
    dueDate: string
    status: string
    tenant: { id: string; name: string; plan: { id: string; name: string } }
  }
  onClose: () => void
}

interface CreateProps {
  mode: 'create'
  tenantId: string
  tenantName: string
  defaultPlanId?: string
  onClose: () => void
  onCreated?: () => void
}

type Props = RetryProps | CreateProps

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

export default function ChargeNowModal(props: Props) {
  const [method, setMethod] = useState<Method>('PIX')
  const [loading, setLoading] = useState(false)
  const [pixResult, setPixResult] = useState<{ pixCopiaECola: string } | null>(null)
  const [boletoResult, setBoletoResult] = useState<{ boletoUrl: string; barCode: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [applyDiscount, setApplyDiscount] = useState(false)
  const [discType, setDiscType] = useState<DiscType>('PERCENT')
  const [discValue, setDiscValue] = useState('')

  // create-mode state
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [cycle, setCycle] = useState<Cycle>('MONTHLY')

  useEffect(() => {
    if (props.mode !== 'create') return
    api.get('/payments/plans').then(r => {
      const list: Plan[] = r.data.data ?? []
      setPlans(list)
      const initial = props.defaultPlanId ?? list[0]?.id ?? ''
      setSelectedPlanId(initial)
    }).catch(() => setPlans([]))
  }, [props.mode, props.mode === 'create' ? props.defaultPlanId : ''])

  const isRetry = props.mode === 'retry'
  const tenantName = isRetry ? props.charge.tenant.name : props.tenantName

  // Compute base value
  let baseValue = 0
  let cycleLabel = ''
  if (isRetry) {
    baseValue = Number(props.charge.amount)
    cycleLabel = props.charge.tenant.plan.name
  } else {
    const plan = plans.find(p => p.id === selectedPlanId)
    if (plan) {
      baseValue = cycle === 'YEARLY' ? Number(plan.priceYearly) : Number(plan.priceMonthly)
      cycleLabel = `${plan.name} · ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`
    }
  }

  const discountedValue = applyDiscount && discValue
    ? (discType === 'PERCENT' ? baseValue * (1 - parseFloat(discValue) / 100) : baseValue - parseFloat(discValue))
    : baseValue
  const finalValue = Math.max(0, Math.round(discountedValue * 100) / 100)

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      let res: any
      if (isRetry) {
        res = await api.post(`/admin/charges/${props.charge.id}/retry`, {
          paymentMethod: method,
          discountValue: applyDiscount ? finalValue : undefined,
        })
      } else {
        if (!selectedPlanId) { setError('Selecione um plano'); setLoading(false); return }
        res = await api.post(`/admin/tenants/${props.tenantId}/charge`, {
          planId: selectedPlanId,
          planCycle: cycle,
          paymentMethod: method,
          discountValue: applyDiscount && discValue ? parseFloat(discValue) : undefined,
          discountType: applyDiscount ? discType : undefined,
        })
      }
      const data = res.data?.data ?? {}
      if (method === 'PIX') setPixResult({ pixCopiaECola: data.pixCopiaECola ?? '' })
      else setBoletoResult({ boletoUrl: data.boletoUrl ?? '', barCode: data.barCode ?? '' })
      if (!isRetry && props.onCreated) props.onCreated()
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao gerar cobrança')
    }
    setLoading(false)
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={props.onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cobrar agora — {tenantName}</h2>
          <button onClick={props.onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, textAlign: 'center', overflowY: 'auto' }}>
          {pixResult ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>{fmt(finalValue)}</div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, display: 'inline-block', marginBottom: 16 }}><QRCodeSVG value={pixResult.pixCopiaECola} size={180} level="M" includeMargin /></div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: 12, textAlign: 'left' }}>{pixResult.pixCopiaECola}</div>
              <button onClick={() => { navigator.clipboard.writeText(pixResult.pixCopiaECola); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}>{copied ? 'Copiado!' : 'Copiar código PIX'}</button>
            </>
          ) : boletoResult ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', marginBottom: 16 }}>{fmt(finalValue)}</div>
              {boletoResult.barCode && <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 12 }}>{boletoResult.barCode}</div>}
              {boletoResult.boletoUrl && <a href={boletoResult.boletoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#3b82f6', color: '#fff', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, textDecoration: 'none', width: '100%' }}><FileText size={14} /> Abrir boleto</a>}
            </>
          ) : (
            <>
              {/* Create-mode: plan + cycle selectors */}
              {!isRetry && (
                <div style={{ textAlign: 'left', marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Plano</label>
                  <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} style={{ ...inputS, appearance: 'none', cursor: 'pointer' }}>
                    {plans.length === 0 && <option value="">Carregando...</option>}
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(Number(p.priceMonthly))}/mês</option>)}
                  </select>

                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, marginTop: 12 }}>Ciclo</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([{ k: 'MONTHLY' as const, l: 'Mensal', badge: '' }, { k: 'YEARLY' as const, l: 'Anual', badge: '-15%' }]).map(c => {
                      const active = cycle === c.k
                      return (
                        <div key={c.k} onClick={() => setCycle(c.k)} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${active ? '#f97316' : 'var(--border)'}`, background: active ? 'rgba(249,115,22,0.08)' : 'transparent', cursor: 'pointer', textAlign: 'center', position: 'relative' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#f97316' : 'var(--text-primary)' }}>{c.l}</div>
                          {c.badge && <span style={{ position: 'absolute', top: -8, right: 8, background: '#22c55e', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>{c.badge}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{fmt(finalValue)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{cycleLabel || (isRetry && `Vencimento ${new Date(props.charge.dueDate).toLocaleDateString('pt-BR')}`)}</div>

              {/* Discount */}
              <div style={{ textAlign: 'left', marginBottom: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={applyDiscount} onChange={() => setApplyDiscount(!applyDiscount)} style={{ accentColor: '#f97316' }} /> Aplicar desconto nesta cobrança
                </label>
                {applyDiscount && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([{ k: 'PERCENT' as const, l: '%' }, { k: 'FIXED' as const, l: 'R$' }]).map(t => (
                        <label key={t.k} onClick={() => setDiscType(t.k)} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${discType === t.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{discType === t.k && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f97316' }} />}</div>{t.l}
                        </label>
                      ))}
                    </div>
                    <input type="number" value={discValue} onChange={e => setDiscValue(e.target.value)} placeholder="Valor" style={{ width: 80, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
                    {discValue && <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>= {fmt(finalValue)}</span>}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'center' }}>
                {([{ k: 'PIX' as const, icon: QrCode, c: '#22c55e', l: 'PIX' }, { k: 'BOLETO' as const, icon: FileText, c: '#3b82f6', l: 'Boleto' }]).map(m => {
                  const I = m.icon
                  const a = method === m.k
                  return (
                    <div key={m.k} onClick={() => setMethod(m.k)} style={{ flex: 1, padding: 14, borderRadius: 10, border: `1px solid ${a ? m.c : 'var(--border)'}`, background: a ? `${m.c}0D` : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
                      <I size={22} color={a ? m.c : 'var(--text-muted)'} strokeWidth={1.5} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{m.l}</div>
                    </div>
                  )
                })}
              </div>
              {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}
              <button onClick={handleGenerate} disabled={loading || (!isRetry && !selectedPlanId)} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: loading || (!isRetry && !selectedPlanId) ? 0.6 : 1 }}>
                {loading && <Loader2 size={14} className="animate-spin" />}{loading ? 'Gerando...' : 'Gerar cobrança'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
