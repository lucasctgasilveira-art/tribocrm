import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import api from '../../../services/api'

// Self-contained styles so this file works without depending on any
// parent's modal primitives — both LeadDetailView and LeadDrawer use it.

const overlayS: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }
const boxS: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const labelS: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }

function Shell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={overlayS} />
      <div style={boxS}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>{footer}</div>
      </div>
    </>
  )
}

// ── Send Email Modal ──

export interface EmailModalLead {
  id: string
  name?: string | null
  company?: string | null
  email?: string | null
}

interface EmailTemplate { id: string; name: string; subject: string; body: string }

export function SendEmailModal({ lead, onClose, onSaved }: { lead: EmailModalLead; onClose: () => void; onSaved: () => void }) {
  const [to, setTo] = useState(lead.email ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/templates/email').then(r => setTemplates(r.data?.data ?? [])).catch(() => {})
  }, [])

  function applyTemplate(id: string) {
    const t = templates.find(x => x.id === id)
    if (!t) return
    const replace = (s: string) => s
      .replace(/\{\{\s*nome\s*\}\}/gi, lead.name ?? '')
      .replace(/\{\{\s*empresa\s*\}\}/gi, lead.company ?? '')
      .replace(/\{\{\s*name\s*\}\}/gi, lead.name ?? '')
      .replace(/\{\{\s*company\s*\}\}/gi, lead.company ?? '')
    setSubject(replace(t.subject))
    setBody(replace(t.body))
  }

  const canSave = !!to && !!subject && !!body && !saving

  async function handleSend() {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await api.post('/email/send', { leadId: lead.id, to, subject, body })
      onSaved()
    } catch (e: any) {
      setSaving(false)
      setError(e?.response?.data?.error?.message ?? 'Erro ao enviar')
    }
  }

  return (
    <Shell title="Enviar e-mail" onClose={onClose} footer={
      <>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={handleSend} disabled={!canSave} style={{ background: canSave ? '#3b82f6' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Enviando...' : 'Enviar'}</button>
      </>
    }>
      {templates.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelS}>Template</label>
          <select onChange={e => applyTemplate(e.target.value)} defaultValue="" style={{ ...inputS, cursor: 'pointer' }}>
            <option value="">Nenhum</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <label style={labelS}>Para</label>
        <input value={to} onChange={e => setTo(e.target.value)} style={inputS} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelS}>Assunto</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} style={inputS} />
      </div>
      <div>
        <label style={labelS}>Corpo</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} style={{ ...inputS, resize: 'vertical' }} />
      </div>
      {error && <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 12 }}>{error}</div>}
    </Shell>
  )
}

// ── Connect Gmail Prompt ──

export function ConnectGmailModal({ onClose, onNavigate }: { onClose: () => void; onNavigate: () => void }) {
  return (
    <Shell title="Gmail não conectado" onClose={onClose} footer={
      <>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Fechar</button>
        <button onClick={onNavigate} style={{ background: '#3b82f6', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Ir para Integrações</button>
      </>
    }>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Para enviar e-mails pelo TriboCRM, conecte sua conta Gmail em{' '}
        <strong style={{ color: 'var(--text-primary)' }}>Configurações → Integrações</strong>.
        Assim os e-mails são enviados do seu próprio endereço e as aberturas são rastreadas.
      </div>
    </Shell>
  )
}
