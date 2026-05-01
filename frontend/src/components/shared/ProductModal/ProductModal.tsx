import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'

// ── Types ──

export interface ProductFormData {
  name: string
  description: string
  category: string
  price: number
  maxDiscount: number
  approvalType: ApprovalType | null
}

type ApprovalType = 'PASSWORD' | 'VALIDATION_QUEUE' | 'BOTH'

export interface EditingProduct {
  id: string
  name: string
  description: string | null
  category: string | null
  price: string | number
  allowsDiscount: boolean
  maxDiscount: string | number | null
  approvalType: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: ProductFormData) => Promise<void> | void
  editing?: EditingProduct | null
}

// ── Styles ──

const CSS = `
  @keyframes pmodalFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pmodalScaleIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  .pmodal-body::-webkit-scrollbar{width:4px}.pmodal-body::-webkit-scrollbar-track{background:transparent}
  .pmodal-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}.pmodal-body{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
`

const baseInput: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box' as const, transition: 'border-color 0.2s, box-shadow 0.2s',
}

function focusEv(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = '#f97316'
  e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
}
function blurEv(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}

// ── Component ──

export default function ProductModal({ open, onClose, onSubmit, editing }: Props) {
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [allowsDiscount, setAllowsDiscount] = useState(false)
  const [maxDiscount, setMaxDiscount] = useState('')
  const [approvalType, setApprovalType] = useState<ApprovalType>('PASSWORD')

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setErrorMsg('')
    if (editing) {
      setName(editing.name ?? '')
      setDescription(editing.description ?? '')
      setCategory(editing.category ?? '')
      setPrice(String(editing.price ?? ''))
      const hasDiscount = !!editing.allowsDiscount && Number(editing.maxDiscount ?? 0) > 0
      setAllowsDiscount(hasDiscount)
      setMaxDiscount(hasDiscount ? String(editing.maxDiscount ?? '') : '')
      const at = editing.approvalType
      setApprovalType(at === 'VALIDATION_QUEUE' || at === 'BOTH' || at === 'PASSWORD' ? at : 'PASSWORD')
    } else {
      setName(''); setDescription(''); setCategory(''); setPrice('')
      setAllowsDiscount(false); setMaxDiscount(''); setApprovalType('PASSWORD')
    }
    setTimeout(() => nameRef.current?.focus(), 100)
  }, [open, editing])

  if (!open) return null

  const priceNum = Number(price.replace(',', '.'))
  const discountNum = Number(maxDiscount.replace(',', '.'))
  const priceValid = price.trim() !== '' && !isNaN(priceNum) && priceNum >= 0
  const discountValid = !allowsDiscount || (maxDiscount.trim() !== '' && !isNaN(discountNum) && discountNum > 0 && discountNum <= 100)

  const canSubmit = name.trim().length > 0 && priceValid && discountValid && !saving

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        price: priceNum,
        maxDiscount: allowsDiscount ? discountNum : 0,
        approvalType: allowsDiscount ? approvalType : null,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message ?? err?.message ?? 'Erro ao salvar produto')
      setSaving(false)
    }
  }

  const isEdit = !!editing

  return (
    <>
      <style>{CSS}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, animation: 'pmodalFadeIn 0.2s ease-out' }} />

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'pmodalScaleIn 0.2s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isEdit ? 'Editar Produto' : 'Novo Produto'}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{isEdit ? 'Atualize as informações do produto' : 'Cadastre um novo produto no catálogo'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="pmodal-body" style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <SectionLabel>Identificação</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 4 }}>
            <Field label="Nome do produto" required>
              <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Consultoria Premium" maxLength={150} style={baseInput} onFocus={focusEv} onBlur={blurEv} />
            </Field>
            <Field label="Descrição">
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição opcional do produto" style={{ ...baseInput, resize: 'none' as const, fontFamily: 'inherit' }} onFocus={focusEv} onBlur={blurEv} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Categoria">
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Serviços" maxLength={80} style={baseInput} onFocus={focusEv} onBlur={blurEv} />
            </Field>
            <Field label="Valor padrão (R$)" required>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" style={baseInput} onFocus={focusEv} onBlur={blurEv} />
            </Field>
          </div>

          <SectionLabel style={{ marginTop: 22 }}>Política de desconto</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
            <input type="checkbox" id="pmodal-allows-discount" checked={allowsDiscount} onChange={e => setAllowsDiscount(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#f97316', cursor: 'pointer' }} />
            <label htmlFor="pmodal-allows-discount" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
              Permitir desconto neste produto
            </label>
          </div>

          {allowsDiscount && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Desconto máximo (%)" required>
                <input type="number" min="0.01" max="100" step="0.01" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} placeholder="Ex: 10" style={baseInput} onFocus={focusEv} onBlur={blurEv} />
              </Field>
              <Field label="Aprovação acima do limite">
                <select value={approvalType} onChange={e => setApprovalType(e.target.value as ApprovalType)} style={{ ...baseInput, appearance: 'none' as const, cursor: 'pointer' }} onFocus={focusEv} onBlur={blurEv}>
                  <option value="PASSWORD">Liberar com senha</option>
                  <option value="VALIDATION_QUEUE">Enviar para validação</option>
                  <option value="BOTH">Permitir as duas opções</option>
                </select>
              </Field>
            </div>
          )}

          {errorMsg && (
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} disabled={saving} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit} style={{
            background: canSubmit ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600,
            color: canSubmit ? '#fff' : 'var(--text-muted)', cursor: canSubmit ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s',
          }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = '#fb923c' }}
            onMouseLeave={e => { e.currentTarget.style.background = canSubmit ? '#f97316' : 'var(--border)' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Produto'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12, fontWeight: 600, ...style }}>{children}</div>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#f97316', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}
