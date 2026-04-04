import { useState } from 'react'
import { Plus, Globe, MoreHorizontal, X, Code, Copy } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

// ── Types ──

interface FormItem {
  id: string; name: string; active: boolean; pipeline: string; stage: string
  responsible: string; leadsCount: number; lastSubmission: string; fields: string[]
}

const forms: FormItem[] = [
  { id: '1', name: 'Formulário do Site Principal', active: true, pipeline: 'Pipeline Principal', stage: 'Sem Contato', responsible: 'Round-robin automático', leadsCount: 38, lastSubmission: 'há 2 horas', fields: ['Nome*', 'E-mail*', 'Telefone*', 'Empresa', 'Mensagem'] },
  { id: '2', name: 'Landing Page Evento', active: true, pipeline: 'Pipeline Principal', stage: 'Em Contato', responsible: 'Ana Souza (fixo)', leadsCount: 9, lastSubmission: 'há 3 dias', fields: ['Nome*', 'E-mail*', 'Telefone*', 'Como nos conheceu'] },
  { id: '3', name: 'Formulário Parceiros', active: false, pipeline: 'Pipeline Parceiros', stage: 'Sem Contato', responsible: 'Pedro Gomes (fixo)', leadsCount: 0, lastSubmission: 'Nunca usado', fields: ['Nome*', 'E-mail*', 'CNPJ', 'Segmento'] },
]

const menuOpts = ['Editar', 'Duplicar', 'Ativar/Desativar', 'Excluir']

const inputS: React.CSSProperties = { width: '100%', background: '#111318', border: '1px solid #22283a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }

// ── Component ──

export default function FormsPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [embedModal, setEmbedModal] = useState<string | null>(null)
  const [newModal, setNewModal] = useState(false)
  const [toast, setToast] = useState('')

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: '#161a22', border: '1px solid #22283a', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#e8eaf0', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Formulários</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Capture leads direto do seu site</p>
        </div>
        <button onClick={() => setNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Formulário
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>3</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>2</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Leads captados</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>47</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Esta semana</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>8</span>
      </div>

      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Globe size={16} color="#3b82f6" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ color: '#9ca3af' }}>Cole o código embed no seu site para capturar leads automaticamente no pipeline.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {forms.map(f => (
          <div key={f.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#22283a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#e8eaf0', flex: 1 }}>{f.name}</span>
              <span style={{ background: f.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: f.active ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{f.active ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Pipeline: <span style={{ color: '#e8eaf0' }}>{f.pipeline} → {f.stage}</span></div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Responsável: <span style={{ color: '#e8eaf0' }}>{f.responsible}</span></div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{f.leadsCount} leads captados · Última submissão {f.lastSubmission}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {f.fields.map(field => (
                <span key={field} style={{ background: '#22283a', color: field.includes('*') ? '#e8eaf0' : '#6b7280', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{field}</span>
              ))}
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #22283a', display: 'flex', gap: 6, position: 'relative' }}>
              <button onClick={() => setEmbedModal(f.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
                <Code size={12} strokeWidth={1.5} /> Ver código embed
              </button>
              <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
              <button onClick={() => setOpenMenu(openMenu === f.id ? null : f.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', marginLeft: 'auto' }}>
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
              {openMenu === f.id && (
                <div style={{ position: 'absolute', right: 0, bottom: 36, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                  {menuOpts.map(opt => <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {embedModal && <EmbedModal formId={embedModal} onClose={() => setEmbedModal(null)} onCopy={() => { setToast('Código copiado!'); setTimeout(() => setToast(''), 2500) }} />}
      {newModal && <NewFormModal onClose={() => setNewModal(false)} />}
    </AppLayout>
  )
}

// ── Embed Modal ──

function EmbedModal({ formId, onClose, onCopy }: { formId: string; onClose: () => void; onCopy: () => void }) {
  const code = `<script src="https://app.tribocrm.com.br/embed.js"\n  data-form="${formId}"\n  data-theme="dark">\n</script>`

  function handleCopy() {
    navigator.clipboard.writeText(code).then(onCopy)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: '#161a22', border: '1px solid #22283a', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Código Embed</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>Cole este código no HTML do seu site onde deseja exibir o formulário.</p>
          <pre style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12, color: '#22c55e', whiteSpace: 'pre-wrap', marginBottom: 12, overflowX: 'auto' }}>{code}</pre>
          <button onClick={handleCopy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}>
            <Copy size={14} strokeWidth={1.5} /> Copiar código
          </button>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Preview</div>
          <div style={{ background: '#f8f9fc', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
              {['Nome completo', 'E-mail', 'Telefone'].map(f => (
                <div key={f}>
                  <div style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>{f}</div>
                  <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#9ca3af' }}>Digite aqui...</div>
                </div>
              ))}
              <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 13, fontWeight: 600, marginTop: 4 }}>Enviar</button>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #22283a', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    </>
  )
}

// ── New Form Modal ──

interface FieldConfig { name: string; enabled: boolean; required: boolean }

function NewFormModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [pipeline, setPipeline] = useState('Pipeline Principal')
  const [stage, setStage] = useState('Sem Contato')
  const [assign, setAssign] = useState<'roundrobin' | 'specific'>('roundrobin')
  const [automation, setAutomation] = useState(false)
  const [fields, setFields] = useState<FieldConfig[]>([
    { name: 'Nome completo', enabled: true, required: true },
    { name: 'E-mail', enabled: true, required: true },
    { name: 'Telefone', enabled: true, required: true },
    { name: 'Empresa', enabled: true, required: false },
    { name: 'Cargo', enabled: false, required: false },
    { name: 'CNPJ', enabled: false, required: false },
    { name: 'Mensagem', enabled: true, required: false },
  ])

  function toggleField(idx: number, key: 'enabled' | 'required') {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: !f[key] } : f))
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, maxWidth: '90vw', maxHeight: '90vh', background: '#161a22', border: '1px solid #22283a', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Novo Formulário</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Section 1 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Nome do formulário <span style={{ color: '#f97316' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Formulário do Site" style={inputS} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Pipeline destino</label>
              <select value={pipeline} onChange={e => setPipeline(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}><option>Pipeline Principal</option><option>Pipeline Parceiros</option></select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Etapa inicial</label>
              <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}><option>Sem Contato</option><option>Em Contato</option></select>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 8 }}>Atribuir para</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['roundrobin', 'specific'] as const).map(v => (
                <label key={v} onClick={() => setAssign(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#e8eaf0' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${assign === v ? '#f97316' : '#22283a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {assign === v && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}
                  </div>
                  {v === 'roundrobin' ? 'Round-robin automático' : 'Vendedor específico'}
                </label>
              ))}
            </div>
          </div>

          {/* Section 2 — Fields */}
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Campos do formulário</div>
          <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', padding: '8px 14px', background: '#0a0b0f', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <span>Campo</span><span style={{ textAlign: 'center' }}>Ativo</span><span style={{ textAlign: 'center' }}>Obrigatório</span>
            </div>
            {fields.map((f, i) => (
              <div key={f.name} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', padding: '10px 14px', borderBottom: i < fields.length - 1 ? '1px solid #22283a' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: f.enabled ? '#e8eaf0' : '#6b7280' }}>{f.name}</span>
                <div style={{ textAlign: 'center' }}>
                  <Toggle on={f.enabled} onToggle={() => toggleField(i, 'enabled')} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  {f.enabled && <Toggle on={f.required} onToggle={() => toggleField(i, 'required')} small />}
                </div>
              </div>
            ))}
          </div>

          {/* Section 3 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Toggle on={automation} onToggle={() => setAutomation(!automation)} />
            <span style={{ fontSize: 13, color: '#e8eaf0' }}>Vincular automação</span>
          </div>
          {automation && (
            <select style={{ ...inputS, marginTop: 8, appearance: 'none' as const, cursor: 'pointer' }}>
              <option>WhatsApp de boas-vindas</option><option>Tarefa ao entrar em contato</option>
            </select>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Cancelar</button>
          <button disabled={!name.trim()} style={{ background: name.trim() ? '#f97316' : '#22283a', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() ? '#fff' : '#6b7280', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Criar formulário</button>
        </div>
      </div>
    </>
  )
}

// ── Toggle ──

function Toggle({ on, onToggle, small }: { on: boolean; onToggle: () => void; small?: boolean }) {
  const w = small ? 28 : 36; const h = small ? 16 : 20; const d = small ? 12 : 16
  return (
    <div onClick={onToggle} style={{ width: w, height: h, borderRadius: 999, background: on ? '#f97316' : '#22283a', display: 'inline-flex', alignItems: 'center', padding: '0 2px', justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
      <div style={{ width: d, height: d, borderRadius: '50%', background: on ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
    </div>
  )
}
