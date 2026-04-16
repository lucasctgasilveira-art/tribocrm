import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Users, Upload, Plus } from 'lucide-react'

/* ─── pipeline stages ─── */
interface Stage {
  name: string
  color: string
  fixed: boolean
}

const defaultStages: Stage[] = [
  { name: 'Sem Contato', color: 'var(--text-muted)', fixed: false },
  { name: 'Em Contato', color: '#3b82f6', fixed: false },
  { name: 'Negociando', color: '#f59e0b', fixed: false },
  { name: 'Proposta Enviada', color: '#a855f7', fixed: false },
  { name: 'Venda Realizada', color: '#22c55e', fixed: true },
  { name: 'Repescagem', color: '#f97316', fixed: false },
  { name: 'Perdido', color: '#ef4444', fixed: true },
]

/* ─── invited member ─── */
interface Member {
  email: string
}

/* ─── step indicator ─── */
function StepBar({ current }: { current: number }) {
  const labels = ['Pipeline', 'Equipe', 'Leads']
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
                  background: done ? '#f97316' : 'var(--border)',
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
                  color: done || active ? '#fff' : 'var(--text-muted)',
                  background: done || active ? '#f97316' : 'var(--border)',
                  transition: 'all 0.3s',
                }}
              >
                {done ? <Check size={16} /> : step}
              </div>
              <span style={{ fontSize: 11, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── shared styles ─── */
const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const btnOrange: React.CSSProperties = {
  background: '#f97316',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  borderRadius: 8,
  padding: '10px 24px',
  border: 'none',
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'none',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: 14,
  borderRadius: 8,
  padding: '10px 24px',
  border: 'none',
  cursor: 'pointer',
}

/* ─── main component ─── */
export default function OnboardingGestorPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [stages, setStages] = useState<Stage[]>(defaultStages)
  const [members, setMembers] = useState<Member[]>([])
  const [newEmail, setNewEmail] = useState('')

  /* ─── pipeline helpers ─── */
  function updateStageName(idx: number, value: string) {
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, name: value } : s)))
  }

  /* ─── team helpers ─── */
  function addMember() {
    const trimmed = newEmail.trim()
    if (!trimmed || members.some((m) => m.email === trimmed)) return
    setMembers((prev) => [...prev, { email: trimmed }])
    setNewEmail('')
  }

  function removeMember(email: string) {
    setMembers((prev) => prev.filter((m) => m.email !== email))
  }

  function initials(email: string) {
    return email.slice(0, 2).toUpperCase()
  }

  /* ─── finish ─── */
  // Fallback for the case the gestor reaches the onboarding without a
  // valid session (signup → verify-email → skips checkout → lands on
  // /gestao/onboarding logged out). PrivateRoute on /gestao/dashboard
  // would silently redirect to /login, making the button feel broken;
  // instead we send them explicitly with a query flag so LoginPage can
  // show "Conta configurada! Faça login …".
  function finish() {
    localStorage.setItem('tribocrm_onboarding_done', 'true')
    const token = localStorage.getItem('accessToken')
    if (!token) {
      navigate('/login?redirect=/gestao/dashboard&msg=onboarding_done')
    } else {
      navigate('/gestao/dashboard')
    }
  }

  /* ─── step content ─── */
  function renderStep() {
    if (step === 1) {
      return (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configure seu pipeline</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 24 }}>
            Seu pipeline já foi criado com as etapas padrão. Você pode renomear as etapas agora ou depois.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stages.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 40, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <input
                  value={s.name}
                  disabled={s.fixed}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateStageName(i, e.target.value)}
                  style={{
                    ...inputBase,
                    opacity: s.fixed ? 0.6 : 1,
                    cursor: s.fixed ? 'not-allowed' : 'text',
                  }}
                  onFocus={(e) => {
                    if (!s.fixed) {
                      e.target.style.borderColor = '#f97316'
                      e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                {s.fixed && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      background: 'var(--border)',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    Fixa
                  </span>
                )}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            As etapas Venda Realizada e Perdido são fixas.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button style={btnOrange} onClick={() => setStep(2)}>
              Está bom assim &rarr;
            </button>
          </div>
        </>
      )
    }

    if (step === 2) {
      return (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cadastre sua equipe</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 24 }}>
            Adicione os vendedores que vão usar o TriboCRM. Eles receberão um convite por e-mail.
          </p>

          {/* add email */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="email"
              placeholder="email@vendedor.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMember())}
              style={{ ...inputBase, flex: 1 }}
              onFocus={(e) => {
                e.target.style.borderColor = '#f97316'
                e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.boxShadow = 'none'
              }}
            />
            <button style={{ ...btnOrange, display: 'flex', alignItems: 'center', gap: 4 }} onClick={addMember}>
              + Adicionar
            </button>
          </div>

          {/* list */}
          {members.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '32px 0',
                color: 'var(--text-muted)',
              }}
            >
              <Users size={32} />
              <span style={{ fontSize: 13 }}>Nenhum vendedor adicionado ainda</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map((m) => (
                <div
                  key={m.email}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#f97316',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {initials(m.email)}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{m.email}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#f59e0b',
                      background: 'rgba(245,158,11,0.10)',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontWeight: 500,
                    }}
                  >
                    Convite pendente
                  </span>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                    onClick={() => removeMember(m.email)}
                  >
                    <X size={16} color="var(--text-muted)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Você pode adicionar mais vendedores depois em Equipe &rarr; Usuários
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button style={btnGhost} onClick={() => setStep(3)}>
              Pular
            </button>
            <button style={btnOrange} onClick={() => setStep(3)}>
              Continuar &rarr;
            </button>
          </div>
        </>
      )
    }

    /* step 3 */
    return (
      <>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Importe seus leads</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 24 }}>
          Você tem leads em uma planilha? Importe agora ou cadastre manualmente depois.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* card 1 — import */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Upload size={28} color="#f97316" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Importar via Excel</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Importe todos os seus leads de uma vez
            </span>
            <button
              style={{
                background: 'none',
                border: '1px solid #f97316',
                color: '#f97316',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Baixar modelo
            </button>
            <div
              style={{
                width: '100%',
                height: 48,
                border: '1px dashed var(--border)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 4,
              }}
            >
              Arraste ou clique para enviar
            </div>
          </div>

          {/* card 2 — manual */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={28} color="var(--text-muted)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Cadastrar manualmente</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Adicione leads um a um pelo pipeline
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Você pode fazer isso depois</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button style={btnGhost} onClick={finish}>
            Fazer depois
          </button>
          <button style={btnOrange} onClick={finish}>
            Ir para o sistema &rarr;
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
        background: 'var(--bg)',
        padding: 16,
      }}
    >
      {/* logo */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>
          <span style={{ fontWeight: 400, color: 'var(--text-primary)' }}>Tribo</span>
          <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
        </h1>
      </div>

      {/* card */}
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
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
