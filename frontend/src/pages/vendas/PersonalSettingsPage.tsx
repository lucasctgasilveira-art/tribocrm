import { useState, useRef } from 'react'
import { Mail, Calendar, Download, Check, MessageCircle, Clock, Linkedin } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import api from '../../services/api'

type Tab = 'integrations' | 'preferences' | 'account'

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

export default function PersonalSettingsPage() {
  const [tab, setTab] = useState<Tab>('integrations')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'integrations', label: 'Integrações' },
    { key: 'preferences', label: 'Preferências' },
    { key: 'account', label: 'Minha Conta' },
  ]

  return (
    <AppLayout menuItems={vendasMenuItems}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Suas preferências e integrações pessoais</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13,
            color: tab === t.key ? '#f97316' : 'var(--text-muted)', fontWeight: tab === t.key ? 500 : 400,
            borderBottom: tab === t.key ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'preferences' && <PreferencesTab />}
      {tab === 'account' && <AccountTab />}
    </AppLayout>
  )
}

// ── Integrations Tab ──

function IntegrationsTab() {
  const features = (items: string[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      {items.map(item => (
        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <Check size={14} color="#22c55e" strokeWidth={2} />{item}
        </div>
      ))}
    </div>
  )

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Gmail */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={20} color="#ef4444" strokeWidth={1.5} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Gmail</div>
              <span style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10 }}>Não conectado</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Envie e-mails para leads diretamente pelo TriboCRM. Seus e-mails saem com seu nome e endereço.</p>
          {features(['Enviar e-mails pelos modelos do gestor', 'Rastreamento de abertura (Plano Pro)', 'Histórico de e-mails no card do lead'])}
          <button style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Conectar Gmail</button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Usamos OAuth2 — nunca compartilhamos sua senha com ninguém.</div>
        </div>

        {/* Google Calendar */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={20} color="#3b82f6" strokeWidth={1.5} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Google Calendar</div>
              <span style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10 }}>Não conectado</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Crie eventos automaticamente ao agendar tarefas no TriboCRM.</p>
          {features(['Evento criado ao criar tarefa com data', 'Badge "Google Calendar" nas tarefas sincronizadas', 'Lembrete automático no seu Calendar'])}
          <button style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Conectar Calendar</button>
        </div>
      </div>

      {/* Chrome Extension — full width */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Download size={20} color="#22c55e" strokeWidth={1.5} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Extensão do Chrome TriboCRM</div>
            <span style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10 }}>Não instalada</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>A extensão transforma seu navegador em uma central de vendas.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <FeatureCard icon={<Linkedin size={18} color="#3b82f6" strokeWidth={1.5} />} text="Capture leads do LinkedIn com 1 clique" />
          <FeatureCard icon={<MessageCircle size={18} color="#25d166" strokeWidth={1.5} />} text="Painel lateral no WhatsApp Web com histórico do lead" />
          <FeatureCard icon={<Clock size={18} color="#f97316" strokeWidth={1.5} />} text="Agende mensagens WhatsApp para envio automático" />
        </div>
        <button style={{ width: '100%', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Instalar extensão gratuita</button>
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>Ver na Chrome Web Store →</div>
      </div>
    </>
  )
}

function FeatureCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
      {icon}
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

// ── Preferences Tab ──

function PreferencesTab() {
  const [darkMode, setDarkMode] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifs, setNotifs] = useState({
    hotLead: true, overdue: true, newTask: true, discount: true, goalReached: true, whatsappFail: true,
  })
  const [defaultFilter, setDefaultFilter] = useState('mine')
  const [defaultView, setDefaultView] = useState<'kanban' | 'list'>('kanban')

  function toggleNotif(key: keyof typeof notifs) { setNotifs(p => ({ ...p, [key]: !p[key] })) }

  const notifItems: { key: keyof typeof notifs; label: string }[] = [
    { key: 'hotLead', label: 'Lead Quente sem contato há 2 dias' },
    { key: 'overdue', label: 'Tarefa atrasada' },
    { key: 'newTask', label: 'Nova tarefa criada para mim' },
    { key: 'discount', label: 'Desconto aprovado/recusado' },
    { key: 'goalReached', label: 'Meta atingida' },
    { key: 'whatsappFail', label: 'Mensagem WhatsApp agendada com falha' },
  ]

  return (
    <div style={card}>
      <SectionLabel>Aparência</SectionLabel>
      <ToggleRow label="Modo escuro" on={darkMode} onToggle={() => setDarkMode(!darkMode)} />
      <ToggleRow label="Sidebar recolhida por padrão" on={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <SectionLabel style={{ marginTop: 20 }}>Notificações</SectionLabel>
      {notifItems.map(n => (
        <ToggleRow key={n.key} label={n.label} on={notifs[n.key]} onToggle={() => toggleNotif(n.key)} />
      ))}

      <SectionLabel style={{ marginTop: 20 }}>Pipeline</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 200 }}>Filtro padrão ao abrir o pipeline</span>
        <select value={defaultFilter} onChange={e => setDefaultFilter(e.target.value)} style={{ ...inputS, width: 'auto', appearance: 'none' as const, cursor: 'pointer', padding: '6px 28px 6px 12px' }}>
          <option value="mine">Meus leads</option><option value="all">Todos os leads</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 200 }}>Vista padrão</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['kanban', 'list'] as const).map(v => (
            <label key={v} onClick={() => setDefaultView(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${defaultView === v ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {defaultView === v && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}
              </div>
              {v === 'kanban' ? 'Kanban' : 'Lista'}
            </label>
          ))}
        </div>
      </div>

      <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 20 }}>Salvar preferências</button>
    </div>
  )
}

// ── Account Tab ──

function AccountTab() {
  return (
    <div style={card}>
      <SectionLabel>Dados pessoais</SectionLabel>
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome completo</label>
              <input defaultValue="Ana Souza" style={inputS} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>E-mail</label>
              <input defaultValue="ana@tribodevendas.com.br" disabled style={{ ...inputS, opacity: 0.6, cursor: 'not-allowed' }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Contate o gestor para alterar</div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Telefone / WhatsApp</label>
              <input defaultValue="(21) 98712-3344" style={inputS} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Cargo</label>
              <input defaultValue="Vendedora" style={inputS} />
            </div>
          </div>
        </div>
        <AvatarUpload initials="AS" />
      </div>

      <SectionLabel style={{ marginTop: 20 }}>Segurança</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Senha atual</label>
          <input type="password" placeholder="••••••••" style={inputS} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nova senha</label>
          <input type="password" placeholder="••••••••" style={inputS} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Confirmar nova senha</label>
          <input type="password" placeholder="••••••••" style={inputS} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Mínimo 8 caracteres, 1 maiúscula, 1 número</div>
      <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Alterar senha</button>

      <SectionLabel style={{ marginTop: 20 }}>Último acesso</SectionLabel>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Último login: hoje às 08:45 — Windows · Chrome</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Sessões ativas: 1 dispositivo</div>

      <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar alterações</button>
    </div>
  )
}

// ── Shared ──

function AvatarUpload({ initials }: { initials: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const stored = JSON.parse(localStorage.getItem('user') ?? '{}') as { avatarUrl?: string }
  const [avatarUrl, setAvatarUrl] = useState(stored.avatarUrl ?? '')
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await api.patch('/users/me', fd)
      const url = res.data.data.avatarUrl
      setAvatarUrl(url)
      const s = JSON.parse(localStorage.getItem('user') ?? '{}')
      s.avatarUrl = url
      localStorage.setItem('user', JSON.stringify(s))
    } catch { /* ignore */ }
    setUploading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="Avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        {uploading ? 'Enviando...' : 'Alterar foto'}
      </button>
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12, fontWeight: 600, ...style }}>{children}</div>
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
      <div onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 999, background: on ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: on ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
      </div>
    </div>
  )
}
