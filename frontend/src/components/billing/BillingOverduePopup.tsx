import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon } from 'lucide-react'
import { useCurrentTenant } from '../../hooks/useCurrentTenant'

const POPUP_STATES = new Set(['OVERDUE_D0_SENT', 'OVERDUE_D7_SENT'])

function storageKey(state: string): string {
  return `billing_popup_seen_${state}`
}

interface PopupCopy {
  title: string
  body: string
}

function copyFor(state: string): PopupCopy | null {
  if (state === 'OVERDUE_D0_SENT') {
    return {
      title: 'Seu pagamento venceu',
      body: 'Sua cobrança do TriboCRM venceu hoje. Regularize agora para continuar usando todas as funcionalidades do sistema sem interrupção.',
    }
  }
  if (state === 'OVERDUE_D7_SENT') {
    return {
      title: 'Sua conta será suspensa em 3 dias',
      body: 'Sua cobrança está há 7 dias em aberto. Se não for paga até D+10, a conta será suspensa automaticamente. Regularize agora para evitar a interrupção.',
    }
  }
  return null
}

export default function BillingOverduePopup() {
  const navigate = useNavigate()
  const { tenant } = useCurrentTenant()
  const [open, setOpen] = useState(false)

  const state = tenant?.lastBillingState ?? null

  useEffect(() => {
    if (!tenant) return
    if (tenant.status !== 'PAYMENT_OVERDUE') return
    if (!state || !POPUP_STATES.has(state)) return
    if (localStorage.getItem(storageKey(state)) === 'true') return
    setOpen(true)
  }, [tenant, state])

  if (!open || !state) return null
  const copy = copyFor(state)
  if (!copy) return null

  function markSeen() {
    if (state) {
      localStorage.setItem(storageKey(state), 'true')
    }
    setOpen(false)
  }

  function handlePay() {
    markSeen()
    navigate('/gestao/assinatura')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 32,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <AlertOctagon size={32} color="#f97316" strokeWidth={2} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
            {copy.title}
          </h2>
        </div>
        <p style={{ margin: 0, marginBottom: 24, fontSize: 14, lineHeight: 1.55, color: '#374151' }}>
          {copy.body}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={markSeen}
            style={{
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              padding: '10px 18px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handlePay}
            style={{
              border: 'none',
              background: '#f97316',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Pagar agora
          </button>
        </div>
      </div>
    </div>
  )
}
