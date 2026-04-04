import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Loader2, ArrowLeft } from 'lucide-react'

const CODE_LENGTH = 6
const MOCK_CODE = '123456'

export default function TwoFactorPage() {
  const navigate = useNavigate()
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  /* focus first input on mount */
  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  function handleChange(idx: number, value: string) {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[idx] = value
    setDigits(next)
    setError(false)

    if (value && idx < CODE_LENGTH - 1) {
      refs.current[idx + 1]?.focus()
    }
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    const next = [...digits]
    for (let i = 0; i < CODE_LENGTH; i++) {
      next[i] = pasted[i] || ''
    }
    setDigits(next)
    setError(false)
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1)
    refs.current[focusIdx]?.focus()
  }

  async function verify() {
    const code = digits.join('')
    if (code.length < CODE_LENGTH) return

    setLoading(true)
    setError(false)

    /* simulate API call */
    await new Promise((r) => setTimeout(r, 1000))

    if (code === MOCK_CODE) {
      navigate('/admin/dashboard')
    } else {
      setLoading(false)
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 40,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
            <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
            <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
          </h1>
        </div>

        {/* shield icon */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Shield size={32} color="#f97316" />
        </div>

        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            textAlign: 'center',
            margin: '0 0 4px',
          }}
        >
          Verificação em dois fatores
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginBottom: 24,
            marginTop: 0,
            lineHeight: 1.5,
          }}
        >
          Digite o código de 6 dígitos do seu aplicativo autenticador (Google Authenticator, Authy...)
        </p>

        {/* code inputs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            animation: shake ? 'shake 0.4s ease-in-out' : undefined,
          }}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              style={{
                width: 48,
                height: 56,
                borderRadius: 8,
                background: 'var(--bg-surface)',
                border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                fontSize: 24,
                fontWeight: 700,
                textAlign: 'center',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                caretColor: '#f97316',
              }}
              onFocus={(e) => {
                if (!error) {
                  e.target.style.borderColor = '#f97316'
                  e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = error ? '#ef4444' : 'var(--border)'
                e.target.style.boxShadow = 'none'
              }}
            />
          ))}
        </div>

        {/* error message */}
        {error && (
          <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', marginTop: 12 }}>
            Código inválido. Tente novamente.
          </p>
        )}

        {/* verify button */}
        <button
          onClick={verify}
          disabled={loading || digits.join('').length < CODE_LENGTH}
          style={{
            width: '100%',
            background: loading ? '#c2590f' : '#f97316',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 8,
            padding: 11,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: loading || digits.join('').length < CODE_LENGTH ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Verificando...
            </>
          ) : (
            'Verificar'
          )}
        </button>

        {/* Dev skip */}
        {import.meta.env.DEV && (
          <button
            onClick={() => navigate('/admin/dashboard')}
            style={{
              width: '100%',
              background: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 8,
              padding: 9,
              border: '1px solid rgba(239,68,68,0.3)',
              cursor: 'pointer',
              marginTop: 12,
            }}
          >
            Pular 2FA (dev only)
          </button>
        )}

        {/* links */}
        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href="#"
            style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}
            onClick={(e) => e.preventDefault()}
          >
            Não consigo acessar meu autenticador
          </a>
          <a
            href="/login"
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
            onClick={(e) => {
              e.preventDefault()
              navigate('/login')
            }}
          >
            <ArrowLeft size={12} /> Voltar para o login
          </a>
        </div>
      </div>

      {/* animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
