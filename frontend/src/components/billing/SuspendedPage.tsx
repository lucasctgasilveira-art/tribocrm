import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'

export default function SuspendedPage() {
  const navigate = useNavigate()

  function handleLogout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0b0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 48,
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316', letterSpacing: -0.5, marginBottom: 32 }}>
          TriboCRM
        </div>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(249,115,22,0.12)',
            color: '#f97316',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={32} strokeWidth={2} />
        </div>
        <h1 style={{ margin: 0, marginBottom: 12, fontSize: 22, fontWeight: 700, color: '#111827' }}>
          Sua conta foi suspensa
        </h1>
        <p style={{ margin: 0, marginBottom: 32, fontSize: 14, lineHeight: 1.55, color: '#4b5563' }}>
          Sua conta foi suspensa por falta de pagamento. Para voltar a usar o TriboCRM, regularize sua cobrança.
        </p>
        <button
          type="button"
          onClick={() => navigate('/gestao/assinatura')}
          style={{
            width: '100%',
            border: 'none',
            background: '#f97316',
            color: '#fff',
            padding: '14px 20px',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 20,
          }}
        >
          Regularizar pagamento
        </button>
        <p style={{ margin: 0, marginBottom: 20, fontSize: 13, lineHeight: 1.55, color: '#6b7280' }}>
          Seus dados estão preservados. Assim que o pagamento for confirmado, o acesso será liberado automaticamente.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: 13,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Sair
        </button>
      </div>
    </div>
  )
}
