import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, MoreHorizontal, MessageCircle, X, Bold, Italic, Strikethrough, Smile, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getWhatsappTemplates, createWhatsappTemplate, updateWhatsappTemplate, deleteWhatsappTemplate } from '../../services/templates.service'

// ── Types ──

interface Template {
  id: string
  name: string
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

function renderWA(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/\{\{nome_lead\}\}/g, 'Camila Torres')
    .replace(/\{\{empresa_lead\}\}/g, 'Torres & Filhos')
    .replace(/\{\{nome_vendedor\}\}/g, 'Ana Souza')
    .replace(/\{\{nome_produto\}\}/g, 'Plano Pro')
    .replace(/\{\{valor_produto\}\}/g, 'R$ 12.000')
    .replace(/\{\{data_hoje\}\}/g, new Date().toLocaleDateString('pt-BR'))
    .replace(/\n/g, '<br/>')
}

// ── Component ──

export default function WhatsappTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getWhatsappTemplates()
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
      await updateWhatsappTemplate(t.id, { isActive: !t.isActive })
      setOpenMenu(null)
      loadTemplates()
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWhatsappTemplate(id)
      setOpenMenu(null)
      loadTemplates()
    } catch { /* ignore */ }
  }

  async function handleCreate(name: string, body: string) {
    try {
      await createWhatsappTemplate({ name, body })
      setModalOpen(false)
      loadTemplates()
    } catch { /* ignore */ }
  }

  const stats = {
    total: templates.length,
    active: templates.filter(t => t.isActive).length,
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Modelos de WhatsApp</h1>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Modelo
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{stats.active}</span>
      </div>

      {/* Info */}
      <div style={{ background: 'rgba(37,209,102,0.08)', border: '1px solid rgba(37,209,102,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <MessageCircle size={16} color="#25d166" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--text-secondary)' }}>Estes modelos ficam disponíveis no painel lateral da extensão do Chrome para envio rápido pelo WhatsApp Web.</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando modelos...</span>
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhum modelo de WhatsApp criado</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {templates.map(t => {
            const vars = extractVars(t.body)
            return (
              <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{t.name}</span>
                  <span style={{ background: t.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: t.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{t.isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.body}</div>
                  {vars.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {vars.map(v => <span key={v} style={{ background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{v}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                    <button style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </button>
                    {openMenu === t.id && (
                      <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                        {menuOpts.map(opt => (
                          <div key={opt}
                            onClick={() => {
                              if (opt === 'Ativar/Desativar') handleToggleActive(t)
                              else if (opt === 'Excluir') handleDelete(t.id)
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
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && <WhatsAppModal onClose={() => setModalOpen(false)} onSave={handleCreate} />}
    </AppLayout>
  )
}

// ── WhatsApp Modal ──

function WhatsAppModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, body: string) => void }) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function insertAt(before: string, after: string) {
    const ta = bodyRef.current; if (!ta) return
    const s = ta.selectionStart; const e = ta.selectionEnd; const sel = body.slice(s, e)
    const text = before + (sel || 'texto') + after
    setBody(body.slice(0, s) + text + body.slice(e))
    setTimeout(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + (sel || 'texto').length }, 0)
  }

  function insertVar(v: string) {
    const ta = bodyRef.current; if (!ta) return
    const s = ta.selectionStart; const tag = `{{${v}}}`
    setBody(body.slice(0, s) + tag + body.slice(ta.selectionEnd))
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + tag.length }, 0)
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Modelo de WhatsApp</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do modelo <span style={{ color: '#f97316' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Primeiro contato" style={inputS} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Mensagem</label>
            <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '8px 12px', display: 'flex', gap: 6, borderRadius: '8px 8px 0 0' }}>
              <FmtBtn icon={<Bold size={14} />} onClick={() => insertAt('*', '*')} title="Negrito" />
              <FmtBtn icon={<Italic size={14} />} onClick={() => insertAt('_', '_')} title="Itálico" />
              <FmtBtn icon={<Strikethrough size={14} />} onClick={() => insertAt('~', '~')} title="Tachado" />
              <FmtBtn icon={<Smile size={14} />} onClick={() => insertAt('😊', '')} title="Emoji" />
            </div>
            <textarea ref={bodyRef} rows={8} value={body} onChange={e => setBody(e.target.value)} placeholder={'Oi {{nome_lead}}! 👋'} style={{ ...inputS, resize: 'none', borderRadius: '0 0 8px 8px', borderTop: 'none', lineHeight: 1.6 }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Use *negrito*, _itálico_, ~tachado~ — formatação compatível com WhatsApp</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Variáveis disponíveis — clique para inserir:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allVars.map(v => <button key={v} onClick={() => insertVar(v)} style={{ background: 'var(--border)', color: '#f97316', borderRadius: 4, padding: '3px 10px', fontSize: 12, border: 'none', cursor: 'pointer' }}>{`{{${v}}}`}</button>)}
            </div>
          </div>
          {body && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Preview</div>
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16 }}>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px 12px 12px 4px', padding: '10px 14px', maxWidth: '85%', position: 'relative' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderWA(body) }} />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>14:30 ✓✓</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(name, body)} disabled={!name.trim()} style={{ background: name.trim() ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() ? '#fff' : 'var(--text-muted)', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Salvar modelo</button>
        </div>
      </div>
    </>
  )
}

function FmtBtn({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{icon}</button>
}
