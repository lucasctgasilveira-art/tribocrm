import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

type Tab = 'emails' | 'security' | 'limits'

interface EmailTemplate {
  label: string
  badge: string
  badgeColor: string
  badgeBg: string
  note: string
  subject: string
  body: string
}

const emailTemplates: EmailTemplate[] = [
  {
    label: 'Boas-vindas ao Gestor',
    badge: 'Automático',
    badgeColor: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.12)',
    note: 'Enviado ao criar tenant',
    subject: 'Bem-vindo ao TriboCRM — sua Máquina de Vendas está pronta!',
    body: 'Olá {nome},\n\nSua conta no TriboCRM foi criada com sucesso! Acesse o painel de gestão para configurar seu pipeline, cadastrar sua equipe e começar a vender mais.\n\nEquipe TriboCRM',
  },
  {
    label: 'Convite ao Vendedor',
    badge: 'Automático',
    badgeColor: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.12)',
    note: 'Enviado ao adicionar vendedor',
    subject: '{nome_gestor} te convidou para o TriboCRM',
    body: 'Olá!\n\n{nome_gestor} convidou você para usar o TriboCRM na empresa {empresa}. Clique no link abaixo para criar sua senha e acessar o sistema.\n\n{link_convite}',
  },
  {
    label: 'Trial expirando (D-7, D-3, D-1)',
    badge: 'Automático',
    badgeColor: '#f59e0b',
    badgeBg: 'rgba(245,158,11,0.12)',
    note: 'Enviado automaticamente nos dias configurados',
    subject: 'Seu trial expira em {dias} dias',
    body: 'Olá {nome},\n\nSeu período de teste no TriboCRM expira em {dias} dias. Faça upgrade agora para não perder seus dados e continuar vendendo.\n\nEquipe TriboCRM',
  },
  {
    label: 'Lembrete de configuração (D+3)',
    badge: 'Automático',
    badgeColor: '#3b82f6',
    badgeBg: 'rgba(59,130,246,0.12)',
    note: 'Enviado 3 dias após criação se onboarding não foi concluído',
    subject: '{nome}, falta pouco para começar a usar o TriboCRM',
    body: 'Olá {nome},\n\nNotamos que você ainda não completou a configuração do seu TriboCRM. Complete o onboarding em menos de 5 minutos e comece a organizar suas vendas.\n\nEquipe TriboCRM',
  },
  {
    label: 'Cobrança gerada',
    badge: 'Automático',
    badgeColor: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.12)',
    note: 'Enviado ao gerar cobrança mensal',
    subject: 'Sua fatura TriboCRM — {mes_ano}',
    body: 'Olá {nome},\n\nSua fatura referente a {mes_ano} no valor de {valor} foi gerada. O pagamento pode ser feito via Pix ou cartão de crédito.\n\nEquipe TriboCRM',
  },
]

const inputS: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const focusH = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = '#f97316'
  e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
}
const blurH = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}

interface SecurityConfig {
  maxAttempts: number
  lockMinutes: number
  tokenHours: number
  force2FA: boolean
  rateLimit: number
}

interface PlanLimits {
  plan: string
  users: string
  leads: string
  pipelines: string
  automations: string
  forms: string
  emailTemplates: string
  wppTemplates: string
}

const defaultSecurity: SecurityConfig = {
  maxAttempts: 5,
  lockMinutes: 30,
  tokenHours: 8,
  force2FA: true,
  rateLimit: 100,
}

const defaultLimits: PlanLimits[] = [
  { plan: 'Gratuito', users: '1', leads: '50', pipelines: '1', automations: '0', forms: '1', emailTemplates: '0', wppTemplates: '0' },
  { plan: 'Solo', users: '1', leads: '1000', pipelines: '1', automations: '0', forms: '3', emailTemplates: '3', wppTemplates: '3' },
  { plan: 'Essencial', users: '3', leads: '5000', pipelines: '3', automations: '3', forms: '5', emailTemplates: '5', wppTemplates: '5' },
  { plan: 'Pro', users: '5', leads: '10000', pipelines: '10', automations: '10', forms: '10', emailTemplates: '10', wppTemplates: '10' },
  { plan: 'Enterprise', users: '10', leads: '50000', pipelines: '∞', automations: '∞', forms: '∞', emailTemplates: '∞', wppTemplates: '∞' },
]

export default function GlobalSettingsPage() {
  const [tab, setTab] = useState<Tab>('emails')
  const [subjects, setSubjects] = useState(() => emailTemplates.map((t) => t.subject))
  const [bodies, setBodies] = useState(() => emailTemplates.map((t) => t.body))
  const [security, setSecurity] = useState<SecurityConfig>(defaultSecurity)
  const [limits, setLimits] = useState<PlanLimits[]>(defaultLimits)
  const [toast, setToast] = useState('')
  const [emailModal, setEmailModal] = useState(false)
  const [newTemplateModal, setNewTemplateModal] = useState(false)
  const [templateActive, setTemplateActive] = useState(() => emailTemplates.map(() => true))
  function toggleTemplate(i: number) { setTemplateActive(p => p.map((v, idx) => idx === i ? !v : v)) }
  const [smtpAccounts, setSmtpAccounts] = useState([
    { label: 'Remetente padrão', email: 'noreply@tribocrm.com.br', type: 'Padrão', active: true },
    { label: 'Cobrança', email: 'cobranca@tribocrm.com.br', type: 'Cobrança', active: true },
  ])

  function toggleSmtp(idx: number) { setSmtpAccounts(p => p.map((a, i) => i === idx ? { ...a, active: !a.active } : a)) }
  function removeSmtp(idx: number) { if (confirm('Remover esta conta?')) setSmtpAccounts(p => p.filter((_, i) => i !== idx)) }
  function addSmtp(acc: { label: string; email: string; type: string }) { setSmtpAccounts(p => [...p, { ...acc, active: true }]); setEmailModal(false); showToast('Conta de e-mail adicionada') }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'emails', label: 'E-mails automáticos' },
    { key: 'security', label: 'Segurança' },
    { key: 'limits', label: 'Planos e limites' },
  ]

  const thS: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 600,
    textAlign: 'left',
  }
  const tdS: React.CSSProperties = {
    padding: '8px 14px',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <AppLayout menuItems={adminMenuItems}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '4px solid #22c55e',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 13,
            color: 'var(--text-primary)',
            zIndex: 60,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}

      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configurações Globais</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Parâmetros do sistema e textos automáticos</p>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              background: tab === t.key ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
              border: `1px solid ${tab === t.key ? '#f97316' : 'var(--border)'}`,
              color: tab === t.key ? '#f97316' : 'var(--text-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── emails ─── */}
      {tab === 'emails' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* SMTP accounts */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Contas de e-mail (SMTP)</span>
              <button onClick={() => setEmailModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Plus size={14} strokeWidth={2} /> Novo E-mail</button>
            </div>
            {smtpAccounts.map((acc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < smtpAccounts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{acc.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{acc.email} · {acc.type}</div>
                </div>
                <div onClick={() => toggleSmtp(i)} style={{ width: 36, height: 20, borderRadius: 999, background: acc.active ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: acc.active ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: acc.active ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
                </div>
                <button onClick={() => removeSmtp(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}><X size={14} strokeWidth={1.5} /></button>
              </div>
            ))}
            {smtpAccounts.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma conta configurada</div>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Templates de e-mail automáticos</div>
            <button onClick={() => setNewTemplateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#f97316', cursor: 'pointer' }}><Plus size={12} strokeWidth={2} /> Novo Modelo</button>
          </div>
          {emailTemplates.map((tpl, i) => (
            <div
              key={tpl.label}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{tpl.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: tpl.badgeColor, background: tpl.badgeBg, borderRadius: 6, padding: '2px 8px' }}>{tpl.badge}</span>
                <div onClick={() => toggleTemplate(i)} style={{ width: 36, height: 20, borderRadius: 999, background: templateActive[i] ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: templateActive[i] ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: templateActive[i] ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{tpl.note}</div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Assunto</label>
              <input
                value={subjects[i]}
                onChange={(e) => {
                  const next = [...subjects]
                  next[i] = e.target.value
                  setSubjects(next)
                }}
                style={{ ...inputS, marginBottom: 10 }}
                onFocus={focusH}
                onBlur={blurH}
              />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Corpo</label>
              <textarea
                value={bodies[i]}
                onChange={(e) => {
                  const next = [...bodies]
                  next[i] = e.target.value
                  setBodies(next)
                }}
                rows={4}
                style={{ ...inputS, resize: 'vertical', fontFamily: 'inherit' }}
                onFocus={focusH}
                onBlur={blurH}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  onClick={() => showToast(`Template "${tpl.label}" salvo com sucesso`)}
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: '6px 16px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── security ─── */}
      {tab === 'security' && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* number fields */}
            {[
              { label: 'Máximo de tentativas de login antes de bloquear', key: 'maxAttempts' as const, value: security.maxAttempts },
              { label: 'Tempo de bloqueio após falhas (minutos)', key: 'lockMinutes' as const, value: security.lockMinutes },
              { label: 'Tempo de expiração do token (horas)', key: 'tokenHours' as const, value: security.tokenHours },
              { label: 'Rate limit (requisições por 15 min por IP)', key: 'rateLimit' as const, value: security.rateLimit },
            ].map((f) => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{f.label}</label>
                <input
                  type="number"
                  value={f.value}
                  onChange={(e) => setSecurity({ ...security, [f.key]: Number(e.target.value) })}
                  style={{ ...inputS, width: 100, textAlign: 'center' }}
                  onFocus={focusH}
                  onBlur={blurH}
                />
              </div>
            ))}

            {/* toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Forçar 2FA para todos os Super Admins</label>
              <button
                onClick={() => setSecurity({ ...security, force2FA: !security.force2FA })}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  background: security.force2FA ? '#f97316' : 'var(--border)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: security.force2FA ? 23 : 3,
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button
              onClick={() => showToast('Configurações de segurança salvas')}
              style={{
                background: '#f97316',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                padding: '10px 20px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Salvar configurações de segurança
            </button>
          </div>
        </div>
      )}

      {/* ─── limits ─── */}
      {tab === 'limits' && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Plano', 'Usuários', 'Leads', 'Pipelines', 'Automações', 'Formulários', 'Modelos E-mail', 'Modelos WPP'].map((h) => (
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {limits.map((row, ri) => (
                <tr key={row.plan}>
                  <td style={{ ...tdS, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.plan}</td>
                  {(['users', 'leads', 'pipelines', 'automations', 'forms', 'emailTemplates', 'wppTemplates'] as const).map((col) => (
                    <td key={col} style={tdS}>
                      <input
                        value={row[col]}
                        onChange={(e) => {
                          const next = limits.map((r, idx) =>
                            idx === ri ? { ...r, [col]: e.target.value } : r
                          )
                          setLimits(next)
                        }}
                        style={{
                          width: 72,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '6px 8px',
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          outline: 'none',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = '#f97316' }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => showToast('Limites dos planos salvos')}
              style={{
                background: '#f97316',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                padding: '10px 20px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Salvar limites
            </button>
          </div>
        </div>
      )}
      {emailModal && <NewEmailModal onClose={() => setEmailModal(false)} onSave={addSmtp} />}
      {newTemplateModal && <NewTemplateModal onClose={() => setNewTemplateModal(false)} onSave={() => { setNewTemplateModal(false); showToast('Template criado') }} />}
    </AppLayout>
  )
}

function NewEmailModal({ onClose, onSave }: { onClose: () => void; onSave: (a: { label: string; email: string; type: string }) => void }) {
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState('Padrão')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const canSave = label.trim() && email.trim()

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nova conta de e-mail</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome (label) *</label><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Remetente padrão" style={inputS} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Endereço de e-mail *</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="noreply@empresa.com" style={inputS} /></div>
          </div>
          <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tipo</label><select value={type} onChange={e => setType(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}><option>Padrão</option><option>Suporte</option><option>Cobrança</option><option>Notificações</option></select></div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Configuração SMTP</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Host SMTP</label><input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" style={inputS} /></div>
            <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Porta</label><input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} style={inputS} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Usuário</label><input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="usuario@empresa.com" style={inputS} /></div>
            <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Senha</label><input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••" style={inputS} /></div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (canSave) onSave({ label, email, type }) }} disabled={!canSave} style={{ background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>Salvar conta</button>
        </div>
      </div>
    </>
  )
}

function NewTemplateModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const vars = ['{nome}', '{empresa}', '{email}', '{link}', '{dias}', '{valor}', '{mes_ano}', '{plano}']

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Template de E-mail</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do template *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Boas-vindas ao cliente" style={inputS} /></div>
          <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Assunto</label><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto do e-mail" style={inputS} /></div>
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Corpo do e-mail</label><textarea rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="Olá {nome}, bem-vindo ao TriboCRM!" style={{ ...inputS, resize: 'none' }} /></div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6, fontWeight: 600 }}>Variáveis disponíveis</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {vars.map(v => <span key={v} style={{ background: 'var(--border)', color: '#f97316', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }} onClick={() => setBody(b => b + v)}>{v}</span>)}
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onSave} disabled={!name.trim()} style={{ background: name.trim() ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() ? '#fff' : 'var(--text-muted)', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Salvar template</button>
        </div>
      </div>
    </>
  )
}
