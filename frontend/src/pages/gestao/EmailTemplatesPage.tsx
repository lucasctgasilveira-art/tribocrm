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

const allVars = [
  { key: 'primeiro_nome', desc: 'Primeiro nome do lead' },
  { key: 'nome_lead', desc: 'Nome completo do lead' },
  { key: 'empresa_lead', desc: 'Empresa do lead' },
  { key: 'nome_vendedor', desc: 'Nome do vendedor' },
  { key: 'nome_produto', desc: 'Nome do produto' },
  { key: 'valor_produto', desc: 'Valor do produto' },
  { key: 'data_hoje', desc: 'Data de hoje' },
]
const menuOpts = ['Excluir']

// ── Component ──

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEmailTemplates()
      setTemplates(data)
    } catch { setTemplates([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  async function handleToggleActive(t: Template) {
    try {
      await updateEmailTemplate(t.id, { isActive: !t.isActive })
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, isActive: !x.isActive } : x))
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try { await deleteEmailTemplate(id); setOpenMenu(null); loadTemplates() } catch { /* ignore */ }
  }

  async function handleSave(name: string, subject: string, body: string, templateId?: string) {
    try {
      if (templateId) {
        await updateEmailTemplate(templateId, { name, subject, body })
      } else {
        await createEmailTemplate({ name, subject, body })
      }
      setModalOpen(false)
      setEditingTemplate(null)
      loadTemplates()
    } catch { /* ignore */ }
  }

  function openEdit(t: Template) {
    setEditingTemplate(t)
    setModalOpen(true)
    setOpenMenu(null)
  }

  const stats = {
    total: templates.length,
    active: templates.filter(t => t.isActive).length,
    inactive: templates.filter(t => !t.isActive).length,
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Modelos de E-mail</h1>
        <button onClick={() => { setEditingTemplate(null); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Modelo
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{stats.active}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Inativos</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.inactive}</span>
      </div>

      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Info size={16} color="#3b82f6" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--text-secondary)' }}>Conecte seu Gmail para enviar e-mails pelos modelos. <span style={{ color: '#f97316', cursor: 'pointer' }}>Conectar agora</span></span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando modelos...</span>
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhum modelo de e-mail criado</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {templates.map(t => {
            const vars = extractVars(t.subject + ' ' + t.body)
            return (
              <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{t.name}</span>
                  {/* Orange toggle switch */}
                  <div onClick={() => handleToggleActive(t)} style={{ width: 36, height: 20, borderRadius: 999, cursor: 'pointer', background: t.isActive ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: t.isActive ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.isActive ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>Assunto: <span style={{ color: 'var(--text-primary)' }}>{t.subject}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.body}</div>
                  {vars.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {vars.map(v => <span key={v} style={{ background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{v}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                    <button onClick={() => openEdit(t)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </button>
                    {openMenu === t.id && (
                      <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                        {menuOpts.map(opt => (
                          <div key={opt} onClick={() => { if (opt === 'Excluir') handleDelete(t.id); else setOpenMenu(null) }}
                            style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }}
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

      {modalOpen && <EmailModal template={editingTemplate} onClose={() => { setModalOpen(false); setEditingTemplate(null) }} onSave={handleSave} />}
    </AppLayout>
  )
}

// ── Modal ──

function EmailModal({ template, onClose, onSave }: { template: Template | null; onClose: () => void; onSave: (name: string, subject: string, body: string, id?: string) => void }) {
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [showPreview, setShowPreview] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const isEdit = !!template

  function insertVar(v: string) {
    const ta = bodyRef.current; if (!ta) return
    const start = ta.selectionStart; const end = ta.selectionEnd
    const tag = `{{${v}}}`
    setBody(body.slice(0, start) + tag + body.slice(end))
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + tag.length }, 0)
  }

  const sampleData: Record<string, string> = {
    primeiro_nome: 'Camila',
    nome_lead: 'Camila Torres',
    empresa_lead: 'Torres & Filhos',
    nome_vendedor: 'Ana Souza',
    nome_produto: 'Plano Pro',
    valor_produto: 'R$ 12.000',
    data_hoje: new Date().toLocaleDateString('pt-BR'),
  }

  function applyPreview(text: string) {
    return allVars.reduce((t, v) => t.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), sampleData[v.key] ?? v.key), text)
  }

  const previewBody = applyPreview(body)
  const previewSubject = applyPreview(subject)

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 640, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isEdit ? 'Editar Modelo' : 'Novo Modelo de E-mail'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do modelo <span style={{ color: '#f97316' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Proposta Comercial" style={inputS} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Assunto <span style={{ color: '#f97316' }}>*</span></label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: Proposta para {{nome_lead}}" style={inputS} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Corpo do e-mail</label>
            <textarea ref={bodyRef} rows={12} value={body} onChange={e => setBody(e.target.value)} placeholder={'Olá {{primeiro_nome}},\n\nEscreva aqui o corpo do e-mail...'} style={{ ...inputS, resize: 'none', fontFamily: 'monospace', lineHeight: 1.6 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Variáveis disponíveis — clique para inserir:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {allVars.map(v => <button key={v.key} onClick={() => insertVar(v.key)} style={{ background: 'var(--border)', color: '#f97316', borderRadius: 4, padding: '3px 10px', fontSize: 12, border: 'none', cursor: 'pointer' }}>{`{{${v.key}}}`}</button>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {allVars.map(v => (
                <div key={v.key} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{`{{${v.key}}}`}</span> — {v.desc}
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setShowPreview(!showPreview)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 12 }}>{showPreview ? 'Ocultar' : 'Ver'} preview</button>
          {showPreview && (body || subject) && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Assunto: {previewSubject || '(vazio)'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{previewBody || '(vazio)'}</div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(name, subject, body, template?.id)} disabled={!name.trim() || !subject.trim()} style={{ background: name.trim() && subject.trim() ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() && subject.trim() ? '#fff' : 'var(--text-muted)', cursor: name.trim() && subject.trim() ? 'pointer' : 'not-allowed' }}>{isEdit ? 'Salvar alterações' : 'Salvar modelo'}</button>
        </div>
      </div>
    </>
  )
}
