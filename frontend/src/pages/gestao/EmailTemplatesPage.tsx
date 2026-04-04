import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, MoreHorizontal, Info, X, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from '../../services/templates.service'

// ── Types ──

interface Template {
  id: string
  name: string
  subject: string
  body: string
  isActive: boolean
  createdAt: string
}

// ── Helpers ──

function extractVars(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? []
  return [...new Set(matches)]
}

const allVars = ['nome_lead', 'empresa_lead', 'nome_vendedor', 'nome_produto', 'valor_produto', 'data_hoje']
const menuOpts = ['Ativar/Desativar', 'Excluir']

// ── Component ──

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEmailTemplates()
      setTemplates(data)
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  async function handleToggleActive(t: Template) {
    try {
      await updateEmailTemplate(t.id, { isActive: !t.isActive })
      setOpenMenu(null)
      loadTemplates()
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEmailTemplate(id)
      setOpenMenu(null)
      loadTemplates()
    } catch { /* ignore */ }
  }

  async function handleCreate(name: string, subject: string, body: string) {
    try {
      await createEmailTemplate({ name, subject, body })
      setModalOpen(false)
      loadTemplates()
    } catch { /* ignore */ }
  }

  const stats = {
    total: templates.length,
    active: templates.filter(t => t.isActive).length,
    inactive: templates.filter(t => !t.isActive).length,
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Modelos de E-mail</h1>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Modelo
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{stats.active}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Inativos</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{stats.inactive}</span>
      </div>

      {/* Gmail warning */}
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Info size={16} color="#3b82f6" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ color: '#9ca3af' }}>Conecte seu Gmail para enviar e-mails pelos modelos. <span style={{ color: '#f97316', cursor: 'pointer' }}>Conectar agora →</span></span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: '#6b7280' }}>Carregando modelos...</span>
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 14 }}>Nenhum modelo de e-mail criado</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {templates.map(t => {
            const vars = extractVars(t.subject + ' ' + t.body)
            return (
              <div key={t.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#22283a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', flex: 1 }}>{t.name}</span>
                  <span style={{ background: t.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: t.isActive ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{t.isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>Assunto: <span style={{ color: '#e8eaf0' }}>{t.subject}</span></div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.body}</div>
                  {vars.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {vars.map(v => <span key={v} style={{ background: '#22283a', color: '#9ca3af', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{v}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #22283a' }}>
                  <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                    <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </button>
                    {openMenu === t.id && (
                      <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                        {menuOpts.map(opt => (
                          <div key={opt}
                            onClick={() => {
                              if (opt === 'Ativar/Desativar') handleToggleActive(t)
                              else if (opt === 'Excluir') handleDelete(t.id)
                              else setOpenMenu(null)
                            }}
                            style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && <EmailModal onClose={() => setModalOpen(false)} onSave={handleCreate} />}
    </AppLayout>
  )
}

// ── Modal ──

function EmailModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, subject: string, body: string) => void }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function insertVar(v: string) {
    const ta = bodyRef.current; if (!ta) return
    const start = ta.selectionStart; const end = ta.selectionEnd
    const tag = `{{${v}}}`
    setBody(body.slice(0, start) + tag + body.slice(end))
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + tag.length }, 0)
  }

  const previewBody = body.replace(/\{\{nome_lead\}\}/g, 'Camila Torres').replace(/\{\{empresa_lead\}\}/g, 'Torres & Filhos').replace(/\{\{nome_vendedor\}\}/g, 'Ana Souza').replace(/\{\{nome_produto\}\}/g, 'Plano Pro').replace(/\{\{valor_produto\}\}/g, 'R$ 12.000').replace(/\{\{data_hoje\}\}/g, new Date().toLocaleDateString('pt-BR'))
  const previewSubject = subject.replace(/\{\{nome_lead\}\}/g, 'Camila Torres').replace(/\{\{empresa_lead\}\}/g, 'Torres & Filhos').replace(/\{\{nome_vendedor\}\}/g, 'Ana Souza')

  const inputS: React.CSSProperties = { width: '100%', background: '#111318', border: '1px solid #22283a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 640, maxWidth: '90vw', maxHeight: '90vh', background: '#161a22', border: '1px solid #22283a', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Novo Modelo de E-mail</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Nome do modelo <span style={{ color: '#f97316' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Proposta Comercial" style={inputS} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Assunto <span style={{ color: '#f97316' }}>*</span></label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: Proposta para {{nome_lead}}" style={inputS} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Corpo do e-mail</label>
            <textarea ref={bodyRef} rows={12} value={body} onChange={e => setBody(e.target.value)} placeholder={'Olá {{nome_lead}},\n\nEscreva aqui o corpo do e-mail...'} style={{ ...inputS, resize: 'none', fontFamily: 'monospace', lineHeight: 1.6 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Variáveis disponíveis — clique para inserir:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allVars.map(v => <button key={v} onClick={() => insertVar(v)} style={{ background: '#22283a', color: '#f97316', borderRadius: 4, padding: '3px 10px', fontSize: 12, border: 'none', cursor: 'pointer' }}>{`{{${v}}}`}</button>)}
            </div>
          </div>
          <button onClick={() => setShowPreview(!showPreview)} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#9ca3af', cursor: 'pointer', marginBottom: 12 }}>👁 {showPreview ? 'Ocultar' : 'Ver'} preview</button>
          {showPreview && (body || subject) && (
            <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 8 }}>Assunto: {previewSubject || '(vazio)'}</div>
              <div style={{ fontSize: 13, color: '#9ca3af', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{previewBody || '(vazio)'}</div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(name, subject, body)} disabled={!name.trim() || !subject.trim()} style={{ background: name.trim() && subject.trim() ? '#f97316' : '#22283a', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() && subject.trim() ? '#fff' : '#6b7280', cursor: name.trim() && subject.trim() ? 'pointer' : 'not-allowed' }}>Salvar modelo</button>
        </div>
      </div>
    </>
  )
}
