import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useCurrentTenant } from '../../hooks/useCurrentTenant'

export default function BillingBanner() {
  const navigate = useNavigate()
  const { tenant } = useCurrentTenant()

  if (tenant?.status !== 'PAYMENT_OVERDUE') return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        background: '#fef3c7',
        borderBottom: '1px solid #f59e0b',
        color: '#92400e',
        fontSize: 14,
        fontWeight: 500,
        minHeight: 44,
      }}
    >
      <AlertTriangle size={18} color="#b45309" strokeWidth={2.25} />
      <span style={{ flex: 1 }}>
        Sua cobrança está em atraso. Regularize para evitar a suspensão da conta.
      </span>
      <button
        type="button"
        onClick={() => navigate('/gestao/assinatura')}
        style={{
          border: '1px solid #f97316',
          background: 'transparent',
          color: '#f97316',
          padding: '6px 14px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Regularizar pagamento
      </button>
    </div>
  )
}
