import { useState, useRef } from 'react'
import { Plus, MoreHorizontal, Info, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

interface Template { id: string; name: string; active: boolean; subject: string; preview: string; vars: string[]; usedCount: number; lastUsed: string }

const templates: Template[] = [
  { id:'1', name:'Proposta Comercial', active:true, subject:'Proposta especial para {{nome_lead}} — {{empresa_lead}}', preview:'Olá {{nome_lead}}, conforme nossa conversa, segue em anexo a proposta...', vars:['nome_lead','empresa_lead','nome_vendedor'], usedCount:12, lastUsed:'há 2 dias' },
  { id:'2', name:'Follow-up 3 dias', active:true, subject:'{{nome_lead}}, ainda tem interesse?', preview:'Oi {{nome_lead}}! Passando para ver se ficou alguma dúvida...', vars:['nome_lead','nome_vendedor'], usedCount:8, lastUsed:'há 5 dias' },
  { id:'3', name:'Boas-vindas ao pipeline', active:true, subject:'Bem-vindo(a), {{nome_lead}}! 👋', preview:'Olá {{nome_lead}}, sou {{nome_vendedor}} e vou acompanhar...', vars:['nome_lead','nome_vendedor','data_hoje'], usedCount:23, lastUsed:'hoje' },
  { id:'4', name:'Envio de contrato', active:true, subject:'Contrato — {{empresa_lead}} × Tribo de Vendas', preview:'{{nome_lead}}, segue o contrato para assinatura...', vars:['nome_lead','empresa_lead'], usedCount:5, lastUsed:'há 1 semana' },
  { id:'5', name:'Motivo de perda', active:true, subject:'{{nome_lead}}, ficamos à disposição', preview:'Entendemos sua decisão e agradecemos o contato...', vars:['nome_lead','nome_vendedor'], usedCount:3, lastUsed:'há 2 semanas' },
  { id:'6', name:'Proposta Expirada', active:false, subject:'Sua proposta expira em 2 dias, {{nome_lead}}', preview:'Olá {{nome_lead}}, notamos que nossa proposta...', vars:['nome_lead'], usedCount:0, lastUsed:'Nunca usado' },
]

const allVars = ['nome_lead','empresa_lead','nome_vendedor','nome_produto','valor_produto','data_hoje']
const menuOpts = ['Editar', 'Duplicar', 'Ativar/Desativar', 'Excluir']

export default function EmailTemplatesPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Modelos de E-mail</h1>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Modelo
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>6</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>5</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Inativos</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>1</span>
      </div>

      {/* Gmail warning */}
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Info size={16} color="#3b82f6" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ color: '#9ca3af' }}>Conecte seu Gmail para enviar e-mails pelos modelos. <span style={{ color: '#f97316', cursor: 'pointer' }}>Conectar agora →</span></span>
      </div>

      {/* Template cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {templates.map(t => (
          <div key={t.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#22283a' }}>
            {/* Top */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', flex: 1 }}>{t.name}</span>
              <span style={{ background: t.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: t.active ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{t.active ? 'Ativo' : 'Inativo'}</span>
            </div>
            {/* Middle */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>Assunto: <span style={{ color: '#e8eaf0' }}>{t.subject}</span></div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.preview}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {t.vars.map(v => <span key={v} style={{ background: '#22283a', color: '#9ca3af', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{`{{${v}}}`}</span>)}
              </div>
            </div>
            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #22283a' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{t.usedCount > 0 ? `Usado ${t.usedCount}x · ${t.lastUsed}` : t.lastUsed}</div>
              <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
                <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>Duplicar</button>
                <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                  <MoreHorizontal size={14} strokeWidth={1.5} />
                </button>
                {openMenu === t.id && (
                  <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                    {menuOpts.map(opt => <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && <EmailModal onClose={() => setModalOpen(false)} />}
    </AppLayout>
  )
}

function EmailModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [tracking, setTracking] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function insertVar(v: string) {
    const ta = bodyRef.current; if (!ta) return
    const start = ta.selectionStart; const end = ta.selectionEnd
    const tag = `{{${v}}}`
    setBody(body.slice(0, start) + tag + body.slice(end))
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + tag.length }, 0)
  }

  const previewBody = body.replace(/\{\{nome_lead\}\}/g, 'Camila Torres').replace(/\{\{empresa_lead\}\}/g, 'Torres & Filhos').replace(/\{\{nome_vendedor\}\}/g, 'Ana Souza').replace(/\{\{nome_produto\}\}/g, 'Plano Pro').replace(/\{\{valor_produto\}\}/g, 'R$ 12.000').replace(/\{\{data_hoje\}\}/g, '03/04/2026')
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div onClick={() => setTracking(!tracking)} style={{ width: 36, height: 20, borderRadius: 999, background: tracking ? '#f97316' : '#22283a', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: tracking ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: tracking ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
            </div>
            <span style={{ fontSize: 13, color: '#e8eaf0' }}>Ativar rastreamento de abertura</span>
            {tracking && <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}>Pixel inserido automaticamente</span>}
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
          <button disabled={!name.trim() || !subject.trim()} style={{ background: name.trim() && subject.trim() ? '#f97316' : '#22283a', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() && subject.trim() ? '#fff' : '#6b7280', cursor: name.trim() && subject.trim() ? 'pointer' : 'not-allowed' }}>Salvar modelo</button>
        </div>
      </div>
    </>
  )
}
