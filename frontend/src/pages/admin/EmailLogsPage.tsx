import { useCallback, useEffect, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import api from '../../services/api'

type EmailStatus = 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED'

interface EmailLog {
  id: string
  tenantId: string | null
  toEmail: string
  templateId: number | null
  subject: string | null
  status: EmailStatus
  brevoMessageId: string | null
  errorReason: string | null
  errorDetails: string | null
  paramsJson: Record<string, unknown> | null
  sentAt: string
}

interface ListResponse {
  items: EmailLog[]
  hasMore: boolean
  nextCursor: string | null
}

const TEMPLATE_NAMES: Record<number, string> = {
  2: 'Trial D-7',
  3: 'Trial D-3',
  4: 'Trial D-1',
  5: 'Cobrança D+0',
  6: 'Último Aviso D+7',
  7: 'Conta Suspensa D+10',
}

const STATUS_BADGE: Record<EmailStatus, { bg: string; color: string; label: string }> = {
  SENT: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Enviado' },
  FAILED: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Falhou' },
  SKIPPED_NOT_CONFIGURED: { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Pulado' },
}

function getTemplateName(id: number | null): string {
  if (!id) return '-'
  return TEMPLATE_NAMES[id] ?? `Template #${id}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function shortId(id: string | null): string {
  if (!id) return '-'
  return id.slice(0, 8)
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  height: 36,
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  paddingRight: 32,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 20,
}

const thS: React.CSSProperties = {
  padding: 12,
  textAlign: 'left',
  fontSize: 11,
  color: 'var(--text-muted)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-card)',
  position: 'sticky',
  top: 0,
}

const tdS: React.CSSProperties = {
  padding: 12,
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
}

interface Filters {
  status: EmailStatus | ''
  toEmail: string
  dateFrom: string
  dateTo: string
  templateId: string
}

const EMPTY_FILTERS: Filters = {
  status: '',
  toEmail: '',
  dateFrom: '',
  dateTo: '',
  templateId: '',
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [searchInput, setSearchInput] = useState('')

  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null)

  // Debounce do input de busca: 400ms
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, toEmail: searchInput }))
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchLogs = useCallback(
    async (cursor: string | null = null) => {
      const isInitial = cursor === null
      if (isInitial) setLoading(true)
      else setLoadingMore(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set('limit', '100')
        if (filters.status) params.set('status', filters.status)
        if (filters.toEmail.trim()) params.set('toEmail', filters.toEmail.trim())
        if (filters.templateId) params.set('templateId', filters.templateId)
        if (filters.dateFrom) {
          params.set('dateFrom', new Date(filters.dateFrom).toISOString())
        }
        if (filters.dateTo) {
          // Inclusive end-of-day
          const dt = new Date(filters.dateTo)
          dt.setHours(23, 59, 59, 999)
          params.set('dateTo', dt.toISOString())
        }
        if (cursor) params.set('cursor', cursor)

        const res = await api.get<{ success: boolean; data: ListResponse }>(
          `/admin/email-logs?${params.toString()}`,
        )
        const data = res.data?.data
        if (!data) {
          setError('Resposta inválida do servidor')
          return
        }
        if (isInitial) {
          setLogs(data.items)
        } else {
          setLogs((prev) => [...prev, ...data.items])
        }
        setHasMore(data.hasMore)
        setNextCursor(data.nextCursor)
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Erro ao carregar logs'
        setError(msg)
        if (isInitial) setLogs([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters],
  )

  // Refetch on filter change (já cobre mount inicial)
  useEffect(() => {
    void fetchLogs(null)
  }, [fetchLogs])

  // Fechar modal via ESC
  useEffect(() => {
    if (!selectedLog) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedLog(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedLog])

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS)
    setSearchInput('')
  }

  function handleLoadMore() {
    if (!nextCursor || loadingMore) return
    void fetchLogs(nextCursor)
  }

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ padding: 32, minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Logs de E-mails
          </h1>
          <p style={{ margin: 0, marginTop: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
            Histórico de todos os emails enviados pelo sistema.
          </p>
        </div>

        {/* Filters card */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as EmailStatus | '' }))}
                style={selectStyle}
              >
                <option value="">Todos</option>
                <option value="SENT">Enviados</option>
                <option value="FAILED">Falharam</option>
                <option value="SKIPPED_NOT_CONFIGURED">Pulados</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', minWidth: 200 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Destinatário
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por destinatário..."
                  style={{ ...inputStyle, paddingLeft: 32, width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                De
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Até
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Template
              </label>
              <select
                value={filters.templateId}
                onChange={(e) => setFilters((f) => ({ ...f, templateId: e.target.value }))}
                style={selectStyle}
              >
                <option value="">Todos</option>
                {Object.entries(TEMPLATE_NAMES).map(([id, name]) => (
                  <option key={id} value={id}>
                    {id} - {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 14px',
                fontSize: 13,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                height: 36,
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Table card */}
        <div style={{ ...card, padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)', display: 'inline-block' }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Carregando logs...</div>
            </div>
          ) : error ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#ef4444', fontSize: 14 }}>
              Erro: {error}
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Nenhum log encontrado com esses filtros.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thS}>Enviado em</th>
                      <th style={thS}>Destinatário</th>
                      <th style={thS}>Template</th>
                      <th style={thS}>Status</th>
                      <th style={thS}>Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const badge = STATUS_BADGE[log.status]
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                          }}
                        >
                          <td style={tdS}>{formatDateTime(log.sentAt)}</td>
                          <td style={tdS}>{log.toEmail}</td>
                          <td style={tdS}>{getTemplateName(log.templateId)}</td>
                          <td style={tdS}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: badge.bg,
                                color: badge.color,
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ ...tdS, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                            {shortId(log.tenantId)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                {hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    style={{
                      background: '#f97316',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 24px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                      opacity: loadingMore ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {loadingMore && <Loader2 size={14} className="animate-spin" />}
                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                  </button>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Fim dos resultados — {logs.length} {logs.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedLog && (
        <EmailLogModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </AppLayout>
  )
}

function EmailLogModal({ log, onClose }: { log: EmailLog; onClose: () => void }) {
  const badge = STATUS_BADGE[log.status]
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: 700,
          maxHeight: '80vh',
          overflow: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          zIndex: 1001,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Detalhes do Log
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <MetaField label="ID" value={log.id} mono />
          <MetaField label="Tenant ID" value={log.tenantId ?? '-'} mono />
          <MetaField label="Enviado em" value={formatDateTime(log.sentAt)} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
              Status
            </div>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.label}
            </span>
          </div>
          <MetaField label="Template" value={getTemplateName(log.templateId)} />
          <MetaField label="Destinatário" value={log.toEmail} />
          {log.subject && <MetaField label="Assunto" value={log.subject} />}
          {log.brevoMessageId && <MetaField label="Brevo Message ID" value={log.brevoMessageId} mono />}
          {log.errorReason && <MetaField label="Error Reason" value={log.errorReason} />}
        </div>

        {/* Params JSON */}
        {log.paramsJson && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Parâmetros do email:
            </div>
            <pre
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                padding: 12,
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 12,
                color: 'var(--text-primary)',
                overflow: 'auto',
                margin: 0,
                maxHeight: 200,
              }}
            >
              {JSON.stringify(log.paramsJson, null, 2)}
            </pre>
          </div>
        )}

        {/* Error details */}
        {log.errorDetails && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
              Detalhes do erro:
            </div>
            <pre
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                padding: 12,
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#fca5a5',
                overflow: 'auto',
                margin: 0,
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
              }}
            >
              {log.errorDetails}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 18px',
              fontSize: 13,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  )
}
