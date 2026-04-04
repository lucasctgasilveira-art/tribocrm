import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Mail, PlayCircle } from 'lucide-react'

/* ─── step bar ─── */
function StepBar({ current }: { current: number }) {
  const labels = ['Gmail', 'Vídeo', 'Lead']
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
      {labels.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  background: done ? '#f97316' : '#22283a',
                  transition: 'background 0.3s',
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  color: done || active ? '#fff' : '#6b7280',
                  background: done || active ? '#f97316' : '#22283a',
                  transition: 'all 0.3s',
                }}
              >
                {done ? <Check size={16} /> : step}
              </div>
              <span style={{ fontSize: 11, color: active ? '#e8eaf0' : '#6b7280' }}>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── shared ─── */
const inputBase: React.CSSProperties = {
  width: '100%',
  background: '#111318',
  border: '1px solid #22283a',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: '#e8eaf0',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const btnOrange: React.CSSProperties = {
  width: '100%',
  background: '#f97316',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  borderRadius: 8,
  padding: '10px 24px',
  border: 'none',
  cursor: 'pointer',
}

/* ─── main ─── */
export default function OnboardingVendedorPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  /* lead form */
  const [leadName, setLeadName] = useState('')
  const [leadCompany, setLeadCompany] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadEmail, setLeadEmail] = useState('')

  function finish() {
    localStorage.setItem('tribocrm_vendedor_onboarding_done', 'true')
    navigate('/vendas/dashboard')
  }

  function renderStep() {
    if (step === 1) {
      return (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Conecte seu Gmail</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 24 }}>
            Envie e-mails para leads sem sair do TriboCRM.
          </p>

          <div
            style={{
              background: '#111318',
              border: '1px solid #22283a',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Mail size={40} color="#ef4444" />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#e8eaf0' }}>Gmail</span>
            <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
              Usamos OAuth2 — nunca compartilhamos sua senha
            </span>
            <button style={{ ...btnOrange, marginTop: 12 }}>Conectar Gmail</button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}
              onClick={() => setStep(2)}
            >
              Pular por agora &rarr;
            </button>
          </div>
        </>
      )
    }

    if (step === 2) {
      return (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Veja como usar o Pipeline</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 24 }}>
            5 minutos que vão transformar sua rotina de vendas.
          </p>

          <div
            style={{
              background: '#0f1117',
              border: '1px solid #22283a',
              borderRadius: 12,
              height: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlayCircle size={48} color="#f97316" />
            <span style={{ fontSize: 13, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
              Como usar o Pipeline Kanban — 5 min
            </span>
          </div>

          <button style={{ ...btnOrange, marginTop: 16 }} onClick={() => setStep(3)}>
            Já assisti, continuar &rarr;
          </button>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}
              onClick={() => setStep(3)}
            >
              Pular por agora &rarr;
            </button>
          </div>
        </>
      )
    }

    /* step 3 */
    return (
      <>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Cadastre seu primeiro lead</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 24 }}>
          Comece com um lead real para ver o sistema funcionando.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Nome completo *', value: leadName, set: setLeadName, ph: 'João da Silva' },
            { label: 'Empresa *', value: leadCompany, set: setLeadCompany, ph: 'Empresa Ltda' },
            { label: 'Telefone/WhatsApp', value: leadPhone, set: setLeadPhone, ph: '(11) 99999-0000' },
            { label: 'E-mail', value: leadEmail, set: setLeadEmail, ph: 'joao@empresa.com' },
          ].map((f) => (
            <div key={f.label}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#e8eaf0', marginBottom: 6 }}>
                {f.label}
              </label>
              <input
                value={f.value}
                onChange={(e: ChangeEvent<HTMLInputElement>) => f.set(e.target.value)}
                placeholder={f.ph}
                style={inputBase}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f97316'
                  e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#22283a'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
          ))}
        </div>

        <button style={{ ...btnOrange, marginTop: 20 }} onClick={finish}>
          Cadastrar e ir para o pipeline &rarr;
        </button>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}
            onClick={finish}
          >
            Fazer depois &rarr;
          </button>
        </div>
      </>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0b0f',
        padding: 16,
      }}
    >
      {/* logo */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
          <span style={{ fontWeight: 400, color: '#e8eaf0' }}>Tribo</span>
          <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
        </h1>
      </div>

      {/* card */}
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          background: '#161a22',
          border: '1px solid #22283a',
          borderRadius: 16,
          padding: '32px 36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        <StepBar current={step} />
        {renderStep()}
      </div>
    </div>
  )
}
