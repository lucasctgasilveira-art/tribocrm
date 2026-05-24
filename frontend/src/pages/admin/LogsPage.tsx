import { useEffect, useState } from 'react'
import { Download, Search, Info, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import {
  getSystemLogs,
  type SystemLogItem,
  type SystemLogPeriod,
} from '../../services/admin.service'

type LogType = 'Login' | 'Erro' | 'Rate Limit' | 'Exportação' | 'Permissão'
type Tab = 'Todos' | 'Erros' | 'Logins' | 'Auditoria'

const typeStyles: Record<LogType, { bg: string; color: string }> = {
  Login: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  Erro: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  'Rate Limit': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'Exportação': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  'Permissão': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
}

const thS: React.CSSProperties = {
  padding: '12px 20px',
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontWeight: 600,
  textAlign: 'left',
}
const tdS: React.CSSProperties = {
  padding: '14px 20px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
}

const selectS: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
}

const periodOptions: { value: SystemLogPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
]

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '—'
  const now = new Date()
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const time = `${hh}:${mm}`
  if (date >= startToday) return `hoje ${time}`
  if (date >= startYesterday) return `ontem ${time}`
  const diffDays = Math.floor((startToday.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays < 7) return `há ${diffDays} dias ${time}`
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>('Todos')
  const [period, setPeriod] = useState<SystemLogPeriod>('7d')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<SystemLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const handle = setTimeout(() => {
      getSystemLogs({ period, search: search || undefined })
        .then(res => {
          if (cancelled) return
          setItems(res.items)
        })
        .catch(err => {
          if (cancelled) return
          console.error('[LogsPage] erro ao buscar logs:', err)
          setError('Não foi possível carregar os logs. Tente novamente.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, search ? 300 : 0)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [period, search])

  const filtered = items.filter((l) => {
    if (tab === 'Logins') return false
    if (tab === 'Auditoria') return false
    if (tab === 'Erros' && l.type !== 'Erro') return false
    return true
  })

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: 'Todos', label: 'Todos', enabled: true },
    { key: 'Erros', label: `Erros (${items.filter((l) => l.type === 'Erro').length})`, enabled: true },
    { key: 'Logins', label: 'Logins (em breve)', enabled: false },
    { key: 'Auditoria', label: 'Auditoria (em breve)', enabled: false },
  ]

  return (
    <AppLayout menuItems={adminMenuItems}>
      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Logs do Sistema</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Auditoria e monitoramento</p>
      </div>

      {/* aviso de cobertura parcial */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Mostrando <strong>falhas reais</strong> de envio de e-mail e webhook.
          Logins, bloqueios por tentativa suspeita, exportações e mudanças de
          permissão serão adicionados nas próximas atualizações.
        </span>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as SystemLogPeriod)}
          style={selectS}
        >
          {periodOptions.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição ou usuário..."
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px 8px 36px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        <button
          disabled
          title="Exportação de CSV chega em uma próxima atualização"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: 'var(--text-muted)',
            cursor: 'not-allowed',
            opacity: 0.6,
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
            onClick={() => t.enabled && setTab(t.key)}
            disabled={!t.enabled}
            title={t.enabled ? undefined : 'Disponível em uma próxima atualização'}
            style={{
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              cursor: t.enabled ? 'pointer' : 'not-allowed',
              background: tab === t.key ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
              border: `1px solid ${tab === t.key ? '#f97316' : 'var(--border)'}`,
              color: tab === t.key ? '#f97316' : 'var(--text-muted)',
              opacity: t.enabled ? 1 : 0.55,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thS}>Tipo</th>
              <th style={thS}>Descrição</th>
              <th style={thS}>Usuário / Tenant</th>
              <th style={thS}>IP</th>
              <th style={thS}>Data / Hora</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                  <Loader2 size={16} style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                  Carregando logs...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={5} style={{ ...tdS, textAlign: 'center', color: '#ef4444', padding: 32 }}>
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                  {tab === 'Logins' || tab === 'Auditoria'
                    ? 'Esta aba será habilitada em uma próxima atualização.'
                    : 'Nenhum log encontrado no período selecionado.'}
                </td>
              </tr>
            )}

            {!loading && !error && filtered.map((l) => {
              const s = typeStyles[l.type]
              return (
                <tr key={l.id}>
                  <td style={tdS}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 6, padding: '3px 10px' }}>
                      {l.type}
                    </span>
                  </td>
                  <td style={tdS}>{l.description}</td>
                  <td style={{ ...tdS, color: 'var(--text-secondary)' }}>{l.user}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{l.ip}</td>
                  <td style={{ ...tdS, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatRelativeDate(l.date)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AppLayout>
  )
}
