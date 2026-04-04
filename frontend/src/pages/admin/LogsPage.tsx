import { useState } from 'react'
import { Download, Search } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

type LogType = 'Login' | 'Erro' | 'Rate Limit' | 'Exportação' | 'Permissão'
type Tab = 'Todos' | 'Erros' | 'Logins' | 'Auditoria'

interface LogEntry {
  type: LogType
  description: string
  user: string
  ip: string
  date: string
}

const typeStyles: Record<LogType, { bg: string; color: string }> = {
  Login: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  Erro: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  'Rate Limit': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'Exportação': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  'Permissão': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
}

const logs: LogEntry[] = [
  { type: 'Login', description: 'Login bem-sucedido', user: 'admin@tribocrm.com.br', ip: '177.92.x.x', date: 'hoje 09:15' },
  { type: 'Erro', description: 'Webhook Efi falhou — timeout', user: 'Sistema', ip: '—', date: 'hoje 08:44' },
  { type: 'Rate Limit', description: 'Limite atingido (100 req/15min)', user: 'IP 189.40.x.x', ip: '189.40.x.x', date: 'hoje 08:32' },
  { type: 'Exportação', description: 'Leads exportados (847 registros)', user: 'ana@torres.com — Torres & Filhos', ip: '201.x.x.x', date: 'ontem 17:20' },
  { type: 'Login', description: 'Login bem-sucedido', user: 'lucas@tribodevendas.com.br', ip: '177.x.x.x', date: 'ontem 16:45' },
  { type: 'Permissão', description: 'Permissão customizada alterada — Ana Souza', user: 'gestor@mendesnet.com', ip: '189.x.x.x', date: 'ontem 14:30' },
  { type: 'Erro', description: 'Falha ao enviar e-mail de boas-vindas', user: 'Sistema', ip: '—', date: 'ontem 11:20' },
  { type: 'Login', description: 'Login bem-sucedido', user: 'marina@tribocrm.com.br', ip: '201.x.x.x', date: 'ontem 09:00' },
  { type: 'Exportação', description: 'Relatório exportado em CSV', user: 'pedro@gomestech.com — GomesTech', ip: '177.x.x.x', date: 'há 2 dias 15:10' },
  { type: 'Erro', description: 'Rate limit — tentativas de login suspeitas', user: 'IP 45.33.x.x', ip: '45.33.x.x', date: 'há 2 dias 03:22' },
]

const thS: React.CSSProperties = {
  padding: '12px 20px',
  fontSize: 11,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontWeight: 600,
  textAlign: 'left',
}
const tdS: React.CSSProperties = {
  padding: '14px 20px',
  fontSize: 13,
  color: '#e8eaf0',
  borderBottom: '1px solid #22283a',
}

const selectS: React.CSSProperties = {
  background: '#111318',
  border: '1px solid #22283a',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: '#e8eaf0',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
}

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>('Todos')
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  const filtered = logs.filter((l) => {
    if (tab === 'Erros' && l.type !== 'Erro') return false
    if (tab === 'Logins' && l.type !== 'Login') return false
    if (tab === 'Auditoria' && l.type !== 'Permissão' && l.type !== 'Exportação') return false
    if (typeFilter !== 'Todos' && l.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return l.description.toLowerCase().includes(q) || l.user.toLowerCase().includes(q)
    }
    return true
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'Todos', label: 'Todos' },
    { key: 'Erros', label: `Erros (${logs.filter((l) => l.type === 'Erro').length})` },
    { key: 'Logins', label: 'Logins' },
    { key: 'Auditoria', label: 'Auditoria' },
  ]

  return (
    <AppLayout menuItems={adminMenuItems}>
      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Logs do Sistema</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Auditoria e monitoramento</p>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectS}>
          {['Todos', 'Login', 'Erro', 'Rate Limit', 'Exportação', 'Permissão'].map((t) => (
            <option key={t} value={t}>{t === 'Todos' ? 'Tipo ▼' : t}</option>
          ))}
        </select>

        <select style={selectS}>
          {['Hoje', 'Últimas 24h', '7 dias', '30 dias'].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} color="#6b7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuário ou ação..."
            style={{
              width: '100%',
              background: '#111318',
              border: '1px solid #22283a',
              borderRadius: 8,
              padding: '8px 12px 8px 36px',
              fontSize: 13,
              color: '#e8eaf0',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)' }}
            onBlur={(e) => { e.target.style.borderColor = '#22283a'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: '1px solid #22283a',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: '#e8eaf0',
            cursor: 'pointer',
          }}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
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
              background: tab === t.key ? 'rgba(249,115,22,0.12)' : '#161a22',
              border: `1px solid ${tab === t.key ? '#f97316' : '#22283a'}`,
              color: tab === t.key ? '#f97316' : '#6b7280',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* table */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #22283a' }}>
              <th style={thS}>Tipo</th>
              <th style={thS}>Descrição</th>
              <th style={thS}>Usuário / Tenant</th>
              <th style={thS}>IP</th>
              <th style={thS}>Data / Hora</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => {
              const s = typeStyles[l.type]
              return (
                <tr key={i}>
                  <td style={tdS}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 6, padding: '3px 10px' }}>
                      {l.type}
                    </span>
                  </td>
                  <td style={tdS}>{l.description}</td>
                  <td style={{ ...tdS, color: '#9ca3af' }}>{l.user}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{l.ip}</td>
                  <td style={{ ...tdS, color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>{l.date}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdS, textAlign: 'center', color: '#6b7280', padding: 32 }}>
                  Nenhum log encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
