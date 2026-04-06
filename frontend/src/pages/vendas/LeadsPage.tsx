import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Loader2, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import { getLeads } from '../../services/leads.service'
import NewLeadModal from '../../components/shared/NewLeadModal/NewLeadModal'

// ── Types ──

interface Lead {
  id: string
  name: string
  company: string | null
  expectedValue: string | number | null
  temperature: 'HOT' | 'WARM' | 'COLD'
  lastActivityAt: string | null
  stage: { id: string; name: string; color: string }
}

interface Meta { total: number; page: number; perPage: number; totalPages: number }

// ── Helpers ──

const tempDisplay: Record<string, { label: string; color: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316' },
  WARM: { label: '🌤 Morno', color: '#f59e0b' },
  COLD: { label: '❄️ Frio', color: '#3b82f6' },
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
function ini(n: string) { return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

// ── Component ──

export default function VendasLeadsPage() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, perPage: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(value); setPage(1) }, 500)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, perPage: 20, status: '' }
        if (debouncedSearch) params.search = debouncedSearch
        const result = await getLeads(params)
        setLeads(result.data ?? [])
        if (result.meta) setMeta(result.meta)
      } catch (err) {
        console.error('[LeadsPage] Error loading leads:', err)
        setLeads([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [debouncedSearch, page, reloadKey])

  return (
    <AppLayout menuItems={vendasMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Meus Leads</h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{meta.total} lead{meta.total !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Novo Lead</button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 280, marginBottom: 16 }}>
        <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar por nome ou empresa..."
          style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36, boxSizing: 'border-box' }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando leads...</span>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Lead', 'Etapa', 'Temperatura', 'Valor', 'Última atividade'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Nenhum lead encontrado</td></tr>
              ) : leads.map(l => {
                const td = tempDisplay[l.temperature]
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => navigate(`/vendas/leads/${l.id}`)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(l.name)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{l.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.company ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: `${l.stage.color}1F`, color: l.stage.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{l.stage.name}</span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: td?.color ?? 'var(--text-muted)' }}>{td?.label ?? l.temperature}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(Number(l.expectedValue) || 0)}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{formatTimeAgo(l.lastActivityAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Mostrando {leads.length === 0 ? 0 : (meta.page - 1) * meta.perPage + 1}-{Math.min(meta.page * meta.perPage, meta.total)} de {meta.total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border)', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'transparent', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page <= 1 ? 0.5 : 1 }}>Anterior</button>
              <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border)', cursor: page >= meta.totalPages ? 'not-allowed' : 'pointer', background: 'var(--bg-card)', color: page >= meta.totalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page >= meta.totalPages ? 0.5 : 1 }}>Próximo</button>
            </div>
          </div>
        </div>
      )}

      <NewLeadModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={() => { setModalOpen(false); setReloadKey(k => k + 1) }} />
    </AppLayout>
  )
}
