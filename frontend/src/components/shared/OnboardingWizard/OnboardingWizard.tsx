import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, X, Pencil, Plus, Download, Upload } from 'lucide-react'
import api from '../../../services/api'
import { getPipelines } from '../../../services/pipeline.service'
import { getUsers, createUser } from '../../../services/users.service'
import { downloadImportTemplate } from '../../../services/leads.service'

// First-access onboarding wizard for gestor (MANAGER/OWNER) users. It
// self-gates based on the `onboardingCompleted` flag stored on the
// tenant (surfaced via the login response as `user.onboardingCompleted`).
// When the flag is true — which is the default for every pre-existing
// tenant thanks to the migration backfill — this component renders
// null and never mounts any heavy children.
//
// The wizard is an overlay on top of AppLayout, NOT a dedicated route,
// so the gestor lands on the dashboard and sees the wizard floating
// above it. Skipping any step still advances the step counter and
// the final "Ir para o sistema" path flips `completed=true`.
//
// Progress is persisted via PATCH /tenants/onboarding, so a gestor
// that closes the browser and comes back resumes where they left off.

interface StoredUser {
  id?: string
  role?: string
  onboardingCompleted?: boolean
  onboardingStep?: number
}

function readStoredUser(): StoredUser {
  try { return JSON.parse(localStorage.getItem('user') ?? '{}') as StoredUser }
  catch { return {} }
}

function persistUserPatch(patch: Partial<StoredUser>) {
  try {
    const current = readStoredUser()
    const next = { ...current, ...patch }
    localStorage.setItem('user', JSON.stringify(next))
    window.dispatchEvent(new Event('userUpdated'))
  } catch { /* ignore */ }
}

interface PipelineStage {
  id: string
  name: string
  color: string
  type: string
  sortOrder: number
  isFixed?: boolean
}

interface PipelineLite {
  id: string
  name: string
  isDefault?: boolean
  stages: PipelineStage[]
}

interface TeamMember {
  id: string
  name: string
  email: string
}

const OVERLAY: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }
const PANEL: CSSProperties = { width: 640, maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }
const INPUT: CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const LABEL: CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }
const PRIMARY_BTN: CSSProperties = { background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const GHOST_BTN: CSSProperties = { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<StoredUser>(() => readStoredUser())

  // Keep the local copy in sync with any other component that writes
  // to localStorage user (Topbar profile edit, etc).
  useEffect(() => {
    function onUpdate() { setUser(readStoredUser()) }
    window.addEventListener('userUpdated', onUpdate)
    return () => window.removeEventListener('userUpdated', onUpdate)
  }, [])

  const role = user.role
  const isGestor = role === 'MANAGER' || role === 'OWNER'
  const shouldShow = isGestor && user.onboardingCompleted === false
  const initialStep = Math.max(1, Math.min(3, (user.onboardingStep ?? 0) + 1))
  const [step, setStep] = useState<1 | 2 | 3>(() => (initialStep as 1 | 2 | 3))

  // Reset the local step if the user object changes underneath us.
  useEffect(() => {
    if (shouldShow) {
      const fresh = Math.max(1, Math.min(3, (user.onboardingStep ?? 0) + 1))
      setStep(fresh as 1 | 2 | 3)
    }
  }, [shouldShow, user.onboardingStep])

  if (!shouldShow) return null

  async function patchOnboarding(body: { step?: number; completed?: boolean }) {
    try {
      const res = await api.patch('/tenants/onboarding', body)
      const data = res.data?.data as { onboardingStep: number; onboardingCompleted: boolean } | undefined
      if (data) {
        persistUserPatch({
          onboardingStep: data.onboardingStep,
          onboardingCompleted: data.onboardingCompleted,
        })
      }
    } catch (err) {
      // Fire-and-forget: failure here must not trap the gestor inside
      // the wizard. Log and move on so they can still reach the system.
      console.error('[OnboardingWizard] persist failed:', err)
    }
  }

  async function goNext() {
    if (step === 3) {
      await patchOnboarding({ completed: true })
      return
    }
    const next = (step + 1) as 1 | 2 | 3
    await patchOnboarding({ step })
    setStep(next)
  }

  async function skipStep() {
    if (step === 3) {
      // Passo 3 "Fazer depois" also closes the wizard — user has the
      // option to never touch it again.
      await patchOnboarding({ completed: true })
      return
    }
    const next = (step + 1) as 1 | 2 | 3
    await patchOnboarding({ step })
    setStep(next)
  }

  return (
    <div style={OVERLAY}>
      <div style={PANEL}>
        <WizardHeader step={step} />
        <div style={{ padding: 28, overflowY: 'auto' }}>
          {step === 1 && <StepPipeline />}
          {step === 2 && <StepTeam />}
          {step === 3 && <StepLeads navigate={navigate} onFinish={goNext} />}
        </div>
        <WizardFooter step={step} onSkip={skipStep} onNext={goNext} />
      </div>
    </div>
  )
}

// ── Header ───────────────────────────────────────────

function WizardHeader({ step }: { step: 1 | 2 | 3 }) {
  const pct = (step / 3) * 100
  return (
    <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontSize: 16, fontWeight: 800 }}>T</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>TriboCRM</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Passo {step} de 3</div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#f97316', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

// ── Footer ───────────────────────────────────────────

function WizardFooter({ step, onSkip, onNext }: { step: 1 | 2 | 3; onSkip: () => void; onNext: () => void }) {
  const skipLabel = step === 3 ? 'Fazer depois' : 'Pular'
  const nextLabel = step === 1 ? 'Está bom assim' : step === 2 ? 'Continuar' : 'Ir para o sistema'
  return (
    <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
      <button onClick={onSkip} style={GHOST_BTN}>{skipLabel}</button>
      <button onClick={onNext} style={PRIMARY_BTN}>{nextLabel} →</button>
    </div>
  )
}

// ── Step 1: Pipeline ─────────────────────────────────

function StepPipeline() {
  const [pipeline, setPipeline] = useState<PipelineLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPipelines()
      .then((data: PipelineLite[]) => {
        const list = data ?? []
        // Prefer the default pipeline, otherwise first.
        const primary = list.find(p => p.isDefault) ?? list[0] ?? null
        setPipeline(primary)
      })
      .catch(() => setPipeline(null))
      .finally(() => setLoading(false))
  }, [])

  // Name-based exclusion keeps the filter robust against legacy tenants
  // whose stage rows may have stale `type`/`isFixed` values (seeded
  // before those fields existed, or imported from older dumps). The
  // three names below are the only platform-fixed stages — everything
  // else is user-editable by design.
  const FIXED_STAGE_NAMES = new Set(['Venda Realizada', 'Perdido', 'Repescagem'])

  const editableStages = useMemo(() => {
    if (!pipeline) return []
    return pipeline.stages
      .filter(s => !FIXED_STAGE_NAMES.has(s.name))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [pipeline])

  // Fallback list for brand-new tenants that haven't created a pipeline
  // yet (so getPipelines() comes back empty) OR for any tenant whose
  // filtered set is empty for whatever reason. Shown as non-editable
  // pills + a pointer to Configurações → Pipeline.
  const FALLBACK_STAGES = ['Sem Contato', 'Em Contato', 'Negociando', 'Proposta Enviada']
  const showFallback = !loading && editableStages.length === 0

  async function saveRename() {
    if (!pipeline || !editingId || !draft.trim()) { setEditingId(null); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.patch(`/pipelines/${pipeline.id}/stages/${editingId}`, { name: draft.trim() })
      const updated = res.data?.data as PipelineStage | undefined
      if (updated) {
        setPipeline(p => p ? { ...p, stages: p.stages.map(s => s.id === editingId ? { ...s, name: updated.name } : s) } : p)
      }
      setEditingId(null)
      setDraft('')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao renomear etapa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Configure seu pipeline</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Seu pipeline já foi criado com as etapas padrão. Você pode renomeá-las clicando em cada uma. As etapas fixas do sistema (Venda Realizada, Repescagem, Perdido) não aparecem aqui.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 }}>
          <Loader2 size={20} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando pipeline...</span>
        </div>
      ) : showFallback ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {FALLBACK_STAGES.map(name => (
              <span
                key={name}
                style={{
                  background: 'rgba(249,115,22,0.08)',
                  border: '1px solid rgba(249,115,22,0.25)',
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#f97316',
                }}
              >
                {name}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Estas são suas etapas padrão. Você pode personalizá-las depois em <strong style={{ color: 'var(--text-secondary)' }}>Configurações → Pipeline</strong>.
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {editableStages.map(stage => {
            const isEditing = editingId === stage.id
            if (isEditing) {
              return (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); saveRename() }
                      if (e.key === 'Escape') { setEditingId(null); setDraft('') }
                    }}
                    style={{ ...INPUT, width: 180, padding: '6px 10px' }}
                    disabled={saving}
                  />
                  <button onClick={saveRename} disabled={saving} style={{ background: '#22c55e', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {saving ? <Loader2 size={14} color="#fff" className="animate-spin" /> : <Check size={14} color="#fff" strokeWidth={2} />}
                  </button>
                  <button onClick={() => { setEditingId(null); setDraft('') }} disabled={saving} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              )
            }
            return (
              <button
                key={stage.id}
                onClick={() => { setEditingId(stage.id); setDraft(stage.name) }}
                style={{
                  background: `${stage.color}1F`,
                  border: `1px solid ${stage.color}66`,
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: stage.color,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {stage.name}
                <Pencil size={12} strokeWidth={1.5} />
              </button>
            )
          })}
        </div>
      )}
      {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>{error}</div>}
    </>
  )
}

// ── Step 2: Team ─────────────────────────────────────

function StepTeam() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('SELLER')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadUsers() {
    setLoading(true)
    try {
      const data = (await getUsers()) as Array<TeamMember & { isActive?: boolean }>
      setMembers((data ?? []).filter(u => u.isActive !== false).map(u => ({ id: u.id, name: u.name, email: u.email })))
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const canSave = name.trim().length >= 2 && emailRe.test(email) && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await createUser({ name: name.trim(), email: email.trim().toLowerCase(), role })
      setName('')
      setEmail('')
      setRole('SELLER')
      setFormOpen(false)
      await loadUsers()
    } catch (e: any) {
      const errData = e?.response?.data?.error
      if (errData?.code === 'PLAN_LIMIT_REACHED') {
        setError(`Limite do plano atingido (${errData.currentCount}/${errData.maxAllowed} usuários).`)
      } else {
        setError(errData?.message ?? 'Erro ao adicionar vendedor')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Cadastre sua equipe</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Adicione os vendedores que vão usar o TriboCRM. Eles receberão um e-mail de convite com senha temporária.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader2 size={18} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          Carregando equipe...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {members.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
              Nenhum vendedor cadastrado ainda.
            </div>
          )}
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <Check size={14} color="#22c55e" strokeWidth={2} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          style={{ ...GHOST_BTN, color: '#f97316', borderColor: 'rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} strokeWidth={2} /> Adicionar vendedor
        </button>
      ) : (
        <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={LABEL}>Nome completo <span style={{ color: '#f97316' }}>*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" style={INPUT} autoFocus />
            </div>
            <div>
              <label style={LABEL}>E-mail <span style={{ color: '#f97316' }}>*</span></label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@empresa.com" style={INPUT} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={LABEL}>Perfil</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...INPUT, appearance: 'none', cursor: 'pointer' }}>
              <option value="SELLER">Vendedor</option>
              <option value="TEAM_LEADER">Líder</option>
            </select>
          </div>
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setFormOpen(false); setError(''); setName(''); setEmail(''); setRole('SELLER') }} style={GHOST_BTN}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave} style={{ ...PRIMARY_BTN, background: canSave ? '#f97316' : 'var(--border)', color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Adicionando...' : 'Adicionar →'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Step 3: Leads ────────────────────────────────────

function StepLeads({ navigate, onFinish }: { navigate: (to: string) => void; onFinish: () => void | Promise<void> }) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadImportTemplate()
    } catch {
      /* service already logs */
    } finally {
      setDownloading(false)
    }
  }

  async function handleImport() {
    // Mark the wizard as complete first so the user doesn't land back
    // inside it when they return from the leads page. Then route them
    // to the full import flow.
    await onFinish()
    navigate('/gestao/leads')
  }

  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Importe seus leads</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Você tem leads em uma planilha? Importe agora usando nosso modelo Excel.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{ ...GHOST_BTN, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 18px' }}
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={1.5} />}
          Baixar modelo Excel
        </button>
        <button
          onClick={handleImport}
          style={{ ...PRIMARY_BTN, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 18px' }}
        >
          <Upload size={16} strokeWidth={1.5} />
          Importar planilha
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
        Ou cadastre seus primeiros leads manualmente depois.
      </p>
    </>
  )
}
