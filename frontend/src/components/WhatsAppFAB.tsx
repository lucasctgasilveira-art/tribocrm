import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { X, Loader2 } from 'lucide-react'

// Floating WhatsApp contact button + mini-form popover. Designed to
// sit on top of the signup page so a hesitant visitor can talk to a
// human before finishing the form. Collects a small set of fields,
// submits them to the public embed form on the TriboCRM backend (so
// the lead lands on the right pipeline), then opens wa.me with a
// pre-filled greeting message.

interface Props {
  name?: string
  email?: string
  phone?: string
}

const FORM_SUBMIT_URL = 'https://api.tribocrm.com.br/public/forms/a9e08d344b60420290ff7bfa/submit'
const WA_NUMBER = '5533991393031'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function maskPhoneBR(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return '(' + digits
  if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2)
  if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6)
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7)
}

// Whatsapp SVG inlined so the component doesn't depend on an external
// icon pack for this single use case. Simplified glyph — recognizable
// at 28px without artifacts.
function WhatsAppIcon({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill={color} aria-hidden="true">
      <path d="M16.002 3C9.374 3 4 8.374 4 15.002c0 2.379.694 4.595 1.89 6.463L4 29l7.704-1.856a11.94 11.94 0 0 0 4.298.792h.004c6.628 0 12.002-5.374 12.002-12.002C28.008 8.374 22.63 3 16.002 3zm0 21.86h-.003a9.9 9.9 0 0 1-5.043-1.38l-.362-.215-4.572 1.101 1.121-4.449-.236-.377a9.87 9.87 0 0 1-1.513-5.254c.001-5.466 4.452-9.917 9.917-9.917 2.65 0 5.14 1.033 7.013 2.908a9.853 9.853 0 0 1 2.904 7.013c-.002 5.466-4.453 9.917-9.918 9.917zm5.439-7.425c-.298-.15-1.763-.871-2.036-.97-.273-.1-.472-.149-.671.15-.199.298-.77.97-.944 1.169-.174.199-.348.224-.646.074-.298-.149-1.258-.464-2.397-1.48-.886-.79-1.484-1.766-1.658-2.064-.174-.298-.018-.459.131-.608.134-.133.298-.348.447-.522.15-.174.199-.298.298-.497.099-.199.05-.373-.025-.522-.075-.149-.671-1.617-.919-2.214-.242-.58-.487-.502-.671-.512l-.572-.01c-.199 0-.522.074-.795.373-.273.298-1.043 1.02-1.043 2.488 0 1.469 1.068 2.888 1.217 3.087.149.199 2.1 3.207 5.087 4.495.711.307 1.266.49 1.699.627.714.227 1.364.195 1.878.118.573-.086 1.763-.721 2.012-1.417.248-.696.248-1.293.174-1.417-.075-.124-.273-.199-.571-.348z"/>
    </svg>
  )
}

export default function WhatsAppFAB({ name: propName, email: propEmail, phone: propPhone }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(propName ?? '')
  const [phone, setPhone] = useState(propPhone ?? '')
  const [email, setEmail] = useState(propEmail ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Keep local state in sync with parent edits — if the gestor types
  // their name into the signup form, the FAB picks it up too.
  useEffect(() => { if (propName !== undefined) setName(propName) }, [propName])
  useEffect(() => { if (propPhone !== undefined) setPhone(propPhone) }, [propPhone])
  useEffect(() => { if (propEmail !== undefined) setEmail(propEmail) }, [propEmail])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Informe seu nome completo.'); return }
    if (phone.replace(/\D/g, '').length < 10) { setError('Informe um telefone válido.'); return }
    if (!EMAIL_RE.test(email.trim())) { setError('Informe um e-mail válido.'); return }

    setLoading(true)
    // Fire-and-forget submission to the public form — even if it
    // fails we still hand the user off to WhatsApp so they never
    // feel stuck. The CRM-side capture is "best effort" here.
    const payload = {
      'Nome completo': name.trim(),
      'Telefone': phone.trim(),
      'E-mail': email.trim().toLowerCase(),
      // Aliases the embed controller already recognises in case the
      // form config later renames the fields.
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
    }
    try {
      await fetch(FORM_SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch { /* ignore — still go to whatsapp */ }

    const greeting = `Olá! Meu nome é ${name.trim()} e gostaria de saber mais sobre o TriboCRM.`
    const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(greeting)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    setLoading(false)
    setOpen(false)
  }

  // ── Styles (inline, to avoid leaking CSS into the rest of the page) ──
  const fabStyle: CSSProperties = {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#25d166',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(37,209,102,0.35), 0 2px 6px rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    transition: 'transform 0.15s',
    padding: 0,
  }

  const popoverBase: CSSProperties = {
    position: 'fixed',
    zIndex: 50,
    background: 'var(--bg-card, #1a1d24)',
    border: '1px solid var(--border, #2a2d35)',
    borderRadius: 12,
    padding: 18,
    boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
    color: 'var(--text-primary, #f3f4f6)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-surface, #22252d)',
    border: '1px solid var(--border, #2a2d35)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--text-primary, #f3f4f6)',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <>
      <button
        type="button"
        aria-label="Fale conosco no WhatsApp"
        onClick={() => setOpen(v => !v)}
        style={fabStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      >
        <WhatsAppIcon />
      </button>

      {open && (
        <div
          style={{
            ...popoverBase,
            bottom: 92,
            right: 24,
            width: 320,
            maxWidth: 'calc(100vw - 24px)',
          }}
          className="tribocrm-wa-popover"
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Fale conosco no WhatsApp</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Tire suas dúvidas direto com o nosso time.</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Nome completo</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="João da Silva" required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Telefone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(maskPhoneBR(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" maxLength={15} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required style={inputStyle} />
            </div>

            {error && (
              <div style={{ marginBottom: 10, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 11 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#1f9f4e' : '#25d166',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 8,
                padding: 10,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: 'inherit',
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading ? <><Loader2 size={14} className="animate-spin" />Abrindo WhatsApp...</> : 'Continuar no WhatsApp →'}
            </button>
          </form>
        </div>
      )}

      {/* Mobile override: full-width popover with 12px margins. Uses a
          scoped class so we don't need to restructure the inline
          styles into a matrix of media queries. */}
      <style>{`
        @media (max-width: 480px) {
          .tribocrm-wa-popover {
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            max-width: none !important;
          }
        }
      `}</style>
    </>
  )
}
