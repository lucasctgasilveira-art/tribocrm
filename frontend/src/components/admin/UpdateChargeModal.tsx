import { useState } from 'react'
import { X, Loader2, Percent, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { updateCharge } from '../../services/admin.service'

interface ChargeLite {
  id: string
  amount: string | number
  discountValue: string | number | null
  status: string
  tenant: { id: string; name: string }
}

interface Props {
  charge: ChargeLite
  onClose: () => void
  onUpdated: () => void
  onResend: () => void
}

type Tab = 'discount' | 'manual' | 'resend'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

export default function UpdateChargeModal({ charge, onClose, onUpdated, onResend }: Props) {
  const [tab, setTab] = useState<Tab>('discount')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Discount tab
  const originalAmount = Number(charge.amount) + Number(charge.discountValue ?? 0)
  const [discountPct, setDiscountPct] = useState('')
  const pct = parseFloat(discountPct) || 0
  const discAbs = Math.round((originalAmount * pct) / 100 * 100) / 100
  const newAmount = Math.max(0, Math.round((originalAmount - discAbs) * 100) / 100)
  const [discNote, setDiscNote] = useState('')

  // Manual paid tab
  const [manualNote, setManualNote] = useState('')
  const [confirmManual, setConfirmManual] = useState(false)

  async function handleApplyDiscount() {
    if (pct <= 0 || pct >= 100) { setError('Informe um percentual entre 0 e 100'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await updateCharge(charge.id, {
        discountValue: discAbs,
        amount: newAmount,
        note: discNote || undefined,
      })
      setSuccess('Desconto registrado no banco. ⚠️ A cobrança original na Efi NÃO foi alterada — clique em "Reenviar cobrança" para o cliente receber o novo valor.')
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao aplicar desconto')
    }
    setSaving(false)
  }

  async function handleManualPaid() {
    setSaving(true); setError(''); setSuccess('')
    try {
      await updateCharge(charge.id, {
        status: 'PAID',
        paymentMethod: 'MANUAL',
        note: manualNote || undefined,
      })
      onUpdated()
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao baixar cobrança')
      setSaving(false)
    }
  }

  function handleClose() {
    if (success) onUpdated()
    else onClose()
  }

  const tabs: { k: Tab; l: string; icon: typeof Percent }[] = [
    { k: 'discount', l: 'Aplicar desconto', icon: Percent },
    { k: 'manual', l: 'Baixar como pago', icon: CheckCircle },
    { k: 'resend', l: 'Reenviar cobrança', icon: RefreshCw },
  ]

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Atualizar cobrança</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{charge.tenant.name} · {fmt(originalAmount)}</div>
          </div>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {tabs.map(t => {
            const I = t.icon
            const active = tab === t.k
            return (
              <button key={t.k} onClick={() => { setTab(t.k); setError(''); setSuccess('') }}
                style={{ flex: 1, padding: '12px 8px', background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? '#f97316' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: active ? '#f97316' : 'var(--text-muted)' }}>
                <I size={14} strokeWidth={1.8} /> {t.l}
              </button>
            )
          })}
        </div>

        <div style={{ padding: 24, overflowY: 'auto' }}>
          {/* DISCOUNT TAB */}
          {tab === 'discount' && (
            <>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Percentual de desconto (%)</label>
              <input
                type="number"
                value={discountPct}
                onChange={e => setDiscountPct(e.target.value)}
                placeholder="Ex: 10"
                min="0"
                max="100"
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />

              {pct > 0 && (
                <div style={{ marginTop: 16, padding: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>De</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{fmt(originalAmount)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>Por</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{fmt(newAmount)}</div>
                  <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>Desconto: {fmt(discAbs)} ({pct}%)</div>
                </div>
              )}

              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, marginTop: 16 }}>Observação (opcional)</label>
              <textarea
                value={discNote}
                onChange={e => setDiscNote(e.target.value)}
                placeholder="Motivo do desconto..."
                rows={2}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', resize: 'none' }}
              />

              {success && (
                <div style={{ marginTop: 16, padding: 12, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} color="#f97316" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{success}</div>
                </div>
              )}
              {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                {success ? (
                  <button onClick={onResend} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={13} strokeWidth={2} /> Reenviar cobrança agora
                  </button>
                ) : (
                  <button onClick={handleApplyDiscount} disabled={saving || pct <= 0} style={{ background: pct > 0 ? '#f97316' : 'var(--border)', color: pct > 0 ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: pct > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Salvando...' : 'Aplicar desconto'}
                  </button>
                )}
              </div>
            </>
          )}

          {/* MANUAL PAID TAB */}
          {tab === 'manual' && (
            <>
              <div style={{ padding: 14, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>Baixa manual</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Marque esta cobrança como paga sem que o cliente tenha pago via PIX/Boleto. Útil para acordos, trocas e cortesias.
                  O método de pagamento será registrado como <strong>MANUAL</strong>.
                </div>
              </div>

              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Observação (opcional)</label>
              <textarea
                value={manualNote}
                onChange={e => setManualNote(e.target.value)}
                placeholder="Motivo da baixa manual: acordo, cortesia, troca de plano..."
                rows={3}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', resize: 'none' }}
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={confirmManual} onChange={() => setConfirmManual(!confirmManual)} style={{ accentColor: '#a855f7' }} />
                Confirmo a baixa manual desta cobrança
              </label>

              {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={handleManualPaid} disabled={saving || !confirmManual} style={{ background: confirmManual ? '#a855f7' : 'var(--border)', color: confirmManual ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: confirmManual ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Salvando...' : 'Baixar como pago'}
                </button>
              </div>
            </>
          )}

          {/* RESEND TAB */}
          {tab === 'resend' && (
            <>
              <div style={{ padding: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Gere um novo PIX ou Boleto para esta cobrança. O valor atual no banco é <strong style={{ color: 'var(--text-primary)' }}>{fmt(Number(charge.amount))}</strong>.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onResend} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={13} strokeWidth={2} /> Abrir reenvio
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
