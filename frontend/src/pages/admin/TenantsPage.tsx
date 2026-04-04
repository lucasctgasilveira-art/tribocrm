import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Search, Plus, MoreHorizontal, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import { getTenants } from '../../services/admin.service'

// ── Types ──

interface Tenant {
  id: string
  name: string
  email: string
  cnpj: string
  status: string
  trialEndsAt: string | null
  createdAt: string
  plan: { id: string; name: string; slug: string; priceMonthly: string | number }
  _count: { users: number; leads: number }
}

interface Meta {
  total: number; page: number; perPage: number; totalPages: number
  stats: { total: number; active: number; trial: number; suspended: number; cancelled: number; newThisMonth: number }
}

// ── Config ──

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Ativo' },
  TRIAL: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Trial' },
  SUSPENDED: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Suspenso' },
  CANCELLED: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', label: 'Cancelado' },
}

const planColors: Record<string, { bg: string; color: string }> = {
  solo: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-secondary)' },
  essencial: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  pro: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  enterprise: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
}

const dropdownOptions = ['Visualizar', 'Editar', 'Suspender', 'Estender Trial', 'Ver cobranças']

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 28px 0 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none',
  height: 36, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

function ini(n: string) { return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

// ── Component ──

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, perPage: 20, totalPages: 0, stats: { total: 0, active: 0, trial: 0, suspended: 0, cancelled: 0, newThisMonth: 0 } })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeTab, setActiveTab] = useState('')
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

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
        const params: Record<string, string | number> = { page, perPage: 20 }
        if (debouncedSearch) params.search = debouncedSearch
        const effectiveStatus = activeTab || statusFilter
        if (effectiveStatus) params.status = effectiveStatus
        const result = await getTenants(params)
        setTenants(result.data)
        setMeta(result.meta)
      } catch {
        setTenants([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [debouncedSearch, statusFilter, activeTab, page])

  const tabFilters = useMemo(() => [
    { key: '', label: 'Todos', count: meta.stats.total },
    { key: 'ACTIVE', label: 'Ativos', count: meta.stats.active },
    { key: 'TRIAL', label: 'Trial', count: meta.stats.trial },
    { key: 'SUSPENDED', label: 'Suspensos', count: meta.stats.suspended },
    { key: 'CANCELLED', label: 'Cancelados', count: meta.stats.cancelled },
  ], [meta.stats])

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Clientes</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Gerencie os clientes da plataforma</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} strokeWidth={2} /> Novo Cliente
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <StatItem label="Ativos" value={String(meta.stats.active)} color="#22c55e" />
        <StatSep />
        <StatItem label="Em Trial" value={String(meta.stats.trial)} color="#3b82f6" />
        <StatSep />
        <StatItem label="Suspensos" value={String(meta.stats.suspended)} color="#f59e0b" />
        <StatSep />
        <StatItem label="Novos este mês" value={`+${meta.stats.newThisMonth}`} color="#22c55e" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ..."
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36, boxSizing: 'border-box' }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setActiveTab(''); setPage(1) }} style={selectStyle}>
          <option value="">Status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED">Suspenso</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabFilters.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setStatusFilter(''); setPage(1) }}
            style={{
              borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: activeTab === tab.key ? 'rgba(249,115,22,0.12)' : 'transparent',
              border: `1px solid ${activeTab === tab.key ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
              color: activeTab === tab.key ? '#f97316' : 'var(--text-muted)',
            }}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando clientes...</span>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Empresa', 'Plano', 'Status', 'Usuários', 'Leads', 'MRR', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Nenhum cliente encontrado</td></tr>
              ) : tenants.map(t => {
                const sc = statusConfig[t.status] ?? statusConfig.ACTIVE!
                const pc = planColors[t.plan.slug] ?? planColors.solo
                const price = Number(t.plan.priceMonthly)
                return (
                  <tr key={t.id} onMouseEnter={() => setHoveredRow(t.id)} onMouseLeave={() => setHoveredRow(null)}
                    style={{ borderBottom: '1px solid var(--border)', background: hoveredRow === t.id ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(t.name)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: pc!.bg, color: pc!.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{t.plan.name}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-primary)' }}>{t._count.users}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-primary)' }}>{t._count.leads.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500, color: t.status === 'TRIAL' || t.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {t.status === 'TRIAL' || t.status === 'CANCELLED' ? '—' : fmt(price)}
                    </td>
                    <td style={{ padding: '14px 20px', position: 'relative' }}>
                      <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openMenu === t.id ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <MoreHorizontal size={14} strokeWidth={1.5} />
                      </button>
                      {openMenu === t.id && (
                        <div style={{ position: 'absolute', right: 20, top: 48, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 180, padding: '4px 0' }}>
                          {dropdownOptions.map(opt => (
                            <div key={opt} onClick={() => setOpenMenu(null)}
                              style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mostrando {tenants.length === 0 ? 0 : (meta.page - 1) * meta.perPage + 1}-{Math.min(meta.page * meta.perPage, meta.total)} de {meta.total} clientes</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border)', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'transparent', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page <= 1 ? 0.5 : 1 }}>Anterior</button>
              <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border)', cursor: page >= meta.totalPages ? 'not-allowed' : 'pointer', background: 'var(--bg-card)', color: page >= meta.totalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page >= meta.totalPages ? 0.5 : 1 }}>Próximo</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function StatSep() {
  return <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
}
