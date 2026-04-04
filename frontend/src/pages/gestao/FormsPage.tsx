import { useState, useEffect, useCallback } from 'react'
import { Plus, Globe, MoreHorizontal, X, Code, Copy, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getForms, getFormStats, createForm, updateForm, deleteForm } from '../../services/forms.service'
import { getPipelines } from '../../services/pipeline.service'

// ── Types ──

interface FieldConfig { label: string; type: string; required: boolean }

interface FormItem {
  id: string
  name: string
  isActive: boolean
  fieldsConfig: FieldConfig[]
  distributionType: string
  embedToken: string
  pipeline: { id: string; name: string }
  stage: { id: string; name: string }
  leadsCount: number
  lastSubmission: string | null
}

interface Stats {
  totalForms: number
  activeForms: number
  totalLeadsCaptured: number
  thisWeekLeads: number
}

interface PipelineOption {
  id: string
  name: string
  stages: { id: string; name: string }[]
}

// ── Helpers ──

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca usado'
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'agora'
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

const distLabels: Record<string, string> = {
  ROUND_ROBIN_ALL: 'Round-robin automático',
  ROUND_ROBIN_TEAM: 'Round-robin por time',
  SPECIFIC_USER: 'Vendedor específico',
  MANUAL: 'Manual',
}

const menuOpts = ['Ativar/Desativar', 'Excluir']

const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

// ── Component ──

export default function FormsPage() {
  const [forms, setForms] = useState<FormItem[]>([])
  const [stats, setStats] = useState<Stats>({ totalForms: 0, activeForms: 0, totalLeadsCaptured: 0, thisWeekLeads: 0 })
  const [pipelines, setPipelines] = useState<PipelineOption[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [embedModal, setEmbedModal] = useState<FormItem | null>(null)
  const [newModal, setNewModal] = useState(false)
  const [toast, setToast] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [formsData, statsData, pipelinesData] = await Promise.all([
        getForms(),
        getFormStats(),
        getPipelines(),
      ])
      setForms(formsData)
      setStats(statsData)
      setPipelines(pipelinesData)
    } catch {
      setForms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleToggleActive(f: FormItem) {
    try {
      await updateForm(f.id, { isActive: !f.isActive })
      setOpenMenu(null)
      loadData()
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await deleteForm(id)
      setOpenMenu(null)
      loadData()
    } catch { /* ignore */ }
  }

  async function handleCreate(payload: { name: string; pipelineId: string; stageId: string; distributionType: string; fieldsConfig: FieldConfig[] }) {
    try {
      await createForm(payload)
      setNewModal(false)
      loadData()
    } catch { /* ignore */ }
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Formulários</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Capture leads direto do seu site</p>
        </div>
        <button onClick={() => setNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Formulário
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.totalForms}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{stats.activeForms}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Leads captados</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.totalLeadsCaptured}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Esta semana</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.thisWeekLeads}</span>
      </div>

      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Globe size={16} color="#3b82f6" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--text-secondary)' }}>Cole o código embed no seu site para capturar leads automaticamente no pipeline.</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando formulários...</span>
        </div>
      ) : forms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhum formulário criado</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {forms.map(f => {
            const fields = (f.fieldsConfig as FieldConfig[]) ?? []
            return (
              <div key={f.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{f.name}</span>
                  <span style={{ background: f.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: f.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{f.isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Pipeline: <span style={{ color: 'var(--text-primary)' }}>{f.pipeline.name} → {f.stage.name}</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Responsável: <span style={{ color: 'var(--text-primary)' }}>{distLabels[f.distributionType] ?? f.distributionType}</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{f.leadsCount} leads captados · Última submissão {formatTimeAgo(f.lastSubmission)}</div>
                {fields.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {fields.map(field => (
                      <span key={field.label} style={{ background: 'var(--border)', color: field.required ? 'var(--text-primary)' : 'var(--text-muted)', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{field.label}{field.required ? '*' : ''}</span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 6, position: 'relative' }}>
                  <button onClick={() => setEmbedModal(f)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Code size={12} strokeWidth={1.5} /> Ver código embed
                  </button>
                  <button style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => setOpenMenu(openMenu === f.id ? null : f.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    <MoreHorizontal size={14} strokeWidth={1.5} />
                  </button>
                  {openMenu === f.id && (
                    <div style={{ position: 'absolute', right: 0, bottom: 36, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                      {menuOpts.map(opt => (
                        <div key={opt}
                          onClick={() => {
                            if (opt === 'Ativar/Desativar') handleToggleActive(f)
                            else if (opt === 'Excluir') handleDelete(f.id)
                            else setOpenMenu(null)
                          }}
                          style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {embedModal && <EmbedModal form={embedModal} onClose={() => setEmbedModal(null)} onCopy={() => { setToast('Código copiado!'); setTimeout(() => setToast(''), 2500) }} />}
      {newModal && <NewFormModal pipelines={pipelines} onClose={() => setNewModal(false)} onSave={handleCreate} />}
    </AppLayout>
  )
}

// ── Embed Modal ──

function EmbedModal({ form, onClose, onCopy }: { form: FormItem; onClose: () => void; onCopy: () => void }) {
  const code = `<script src="https://app.tribocrm.com.br/embed.js"\n  data-form="${form.embedToken}"\n  data-theme="dark">\n</script>`

  function handleCopy() {
    navigator.clipboard.writeText(code).then(onCopy)
  }

  const fields = (form.fieldsConfig as FieldConfig[]) ?? []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Código Embed</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Cole este código no HTML do seu site onde deseja exibir o formulário.</p>
          <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12, color: '#22c55e', whiteSpace: 'pre-wrap', marginBottom: 12, overflowX: 'auto' }}>{code}</pre>
          <button onClick={handleCopy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}>
            <Copy size={14} strokeWidth={1.5} /> Copiar código
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Preview</div>
          <div style={{ background: '#f8f9fc', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
              {fields.filter(f => f.required || true).map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: 'var(--border)', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ background: '#fff', border: '1px solid var(--text-secondary)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>Digite aqui...</div>
                </div>
              ))}
              <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 13, fontWeight: 600, marginTop: 4 }}>Enviar</button>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    </>
  )
}

// ── New Form Modal ──

function NewFormModal({ pipelines, onClose, onSave }: { pipelines: PipelineOption[]; onClose: () => void; onSave: (payload: { name: string; pipelineId: string; stageId: string; distributionType: string; fieldsConfig: FieldConfig[] }) => void }) {
  const [name, setName] = useState('')
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '')
  const [stageId, setStageId] = useState('')
  const [assign, setAssign] = useState('ROUND_ROBIN_ALL')
  const [fields, setFields] = useState<(FieldConfig & { enabled: boolean })[]>([
    { label: 'Nome completo', type: 'text', required: true, enabled: true },
    { label: 'E-mail', type: 'text', required: true, enabled: true },
    { label: 'Telefone', type: 'text', required: true, enabled: true },
    { label: 'Empresa', type: 'text', required: false, enabled: true },
    { label: 'Cargo', type: 'text', required: false, enabled: false },
    { label: 'CNPJ', type: 'text', required: false, enabled: false },
    { label: 'Mensagem', type: 'text', required: false, enabled: true },
  ])

  const selectedPipeline = pipelines.find(p => p.id === pipelineId)
  const stages = selectedPipeline?.stages ?? []

  useEffect(() => {
    if (stages.length > 0 && !stageId) setStageId(stages[0]!.id)
  }, [pipelineId, stages, stageId])

  function toggleField(idx: number, key: 'enabled' | 'required') {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: !f[key] } : f))
  }

  function handleSave() {
    const activeFields = fields.filter(f => f.enabled).map(f => ({ label: f.label, type: f.type, required: f.required }))
    onSave({ name, pipelineId, stageId, distributionType: assign, fieldsConfig: activeFields })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Formulário</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do formulário <span style={{ color: '#f97316' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Formulário do Site" style={inputS} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Pipeline destino</label>
              <select value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId('') }} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Etapa inicial</label>
              <select value={stageId} onChange={e => setStageId(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Atribuir para</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['ROUND_ROBIN_ALL', 'SPECIFIC_USER'] as const).map(v => (
                <label key={v} onClick={() => setAssign(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${assign === v ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {assign === v && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}
                  </div>
                  {v === 'ROUND_ROBIN_ALL' ? 'Round-robin automático' : 'Vendedor específico'}
                </label>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Campos do formulário</div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', padding: '8px 14px', background: 'var(--bg)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <span>Campo</span><span style={{ textAlign: 'center' }}>Ativo</span><span style={{ textAlign: 'center' }}>Obrigatório</span>
            </div>
            {fields.map((f, i) => (
              <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', padding: '10px 14px', borderBottom: i < fields.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: f.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{f.label}</span>
                <div style={{ textAlign: 'center' }}>
                  <Toggle on={f.enabled} onToggle={() => toggleField(i, 'enabled')} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  {f.enabled && <Toggle on={f.required} onToggle={() => toggleField(i, 'required')} small />}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim() || !pipelineId || !stageId} style={{ background: name.trim() && pipelineId && stageId ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() && pipelineId && stageId ? '#fff' : 'var(--text-muted)', cursor: name.trim() && pipelineId && stageId ? 'pointer' : 'not-allowed' }}>Criar formulário</button>
        </div>
      </div>
    </>
  )
}

// ── Toggle ──

function Toggle({ on, onToggle, small }: { on: boolean; onToggle: () => void; small?: boolean }) {
  const w = small ? 28 : 36; const h = small ? 16 : 20; const d = small ? 12 : 16
  return (
    <div onClick={onToggle} style={{ width: w, height: h, borderRadius: 999, background: on ? '#f97316' : 'var(--border)', display: 'inline-flex', alignItems: 'center', padding: '0 2px', justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
      <div style={{ width: d, height: d, borderRadius: '50%', background: on ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
    </div>
  )
}
