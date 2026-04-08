import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TrendingUp, BarChart2, AlertCircle, UserMinus, DollarSign, Download, Loader2, Search, X, Plus, MoreHorizontal } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import ChargeNowModal from '../../components/admin/ChargeNowModal'
import UpdateChargeModal from '../../components/admin/UpdateChargeModal'
import { adminMenuItems } from '../../config/adminMenu'
import { getFinancial, getTenants, getTenant, updateCharge } from '../../services/admin.service'

// ── Types ──

type Period = 'month' | 'quarter' | 'year'

interface Charge {
  id: string
  amount: string | number
  discountValue: string | number | null
  createdAt: string
  dueDate: string
  paidAt: string | null
  status: string
  paymentMethod: string
  note: string | null
  tenant: { id: string; name: string; plan: { id: string; name: string; slug: string } }
}

interface FinancialData {
  kpis: { mrr: number; arr: number; overdueCount: number; churnRate: number; averageTicket: number }
  charges: Charge[]
}

interface TenantSearchResult {
  id: string
  name: string
  tradeName: string | null
  cnpj: string
}

// ── Config ──

const statusS: Record<string, { bg: string; color: string; label: string }> = {
  PAID: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Pago' },
  PAID_MANUAL: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: 'Pago manualmente' },
  PENDING: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Pendente' },
  OVERDUE: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Vencido' },
  CANCELLED: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', label: 'Cancelado' },
}

function statusKey(c: { status: string; paymentMethod: string }): string {
  if (c.status === 'PAID' && c.paymentMethod === 'MANUAL') return 'PAID_MANUAL'
  return c.status
}

const planColors: Record<string, { bg: string; color: string }> = {
  solo: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-secondary)' },
  essencial: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  pro: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  enterprise: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }) }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }
function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

const thS: React.CSSProperties = { padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '14px 14px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

// ── Component ──

export default function FinancialPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tenantId = searchParams.get('tenantId')

  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')
  const [chargeModal, setChargeModal] = useState<Charge | null>(null)
  const [updateModal, setUpdateModal] = useState<Charge | null>(null)
  const [newChargeModal, setNewChargeModal] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  function reload() { setReloadKey(k => k + 1) }

  async function handleCancelCharge(c: Charge) {
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return
    try {
      await updateCharge(c.id, { status: 'CANCELLED' })
      showToast('Cobrança cancelada')
      reload()
    } catch (e: any) {
      showToast(e.response?.data?.error?.message ?? 'Erro ao cancelar cobrança')
    }
  }

  // Selected tenant info (when filtered)
  const [selectedTenant, setSelectedTenant] = useState<{ id: string; name: string; cnpj: string } | null>(null)

  // Search state (when no tenant selected)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<TenantSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load financial data — period only matters when no tenant filter
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params: { period?: string; tenantId?: string } = {}
        if (tenantId) params.tenantId = tenantId
        else params.period = period
        const result = await getFinancial(params)
        setData(result)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period, tenantId, reloadKey])

  // Load selected tenant info when tenantId is in URL
  useEffect(() => {
    if (!tenantId) { setSelectedTenant(null); return }
    getTenant(tenantId).then(t => {
      setSelectedTenant({ id: t.id, name: t.name, cnpj: t.cnpj })
    }).catch(() => setSelectedTenant(null))
  }, [tenantId])

  // Debounced tenant search
  function handleSearchChange(v: string) {
    setSearchTerm(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!v.trim()) { setSearchResults([]); setShowResults(false); return }
    debounceRef.current = setTimeout(() => {
      runSearch(v)
    }, 300)
  }

  async function runSearch(term: string) {
    setSearching(true)
    setShowResults(true)
    try {
      const r = await getTenants({ search: term, perPage: 10 })
      setSearchResults(r.data ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  function selectTenant(t: TenantSearchResult) {
    setShowResults(false)
    setSearchTerm('')
    setSearchResults([])
    setSearchParams({ tenantId: t.id })
  }

  function clearTenantFilter() {
    setSearchParams({})
  }

  const periods: { key: Period; label: string }[] = [{ key: 'month', label: 'Este mês' }, { key: 'quarter', label: 'Trimestre' }, { key: 'year', label: 'Ano' }]

  const kpis = data?.kpis ?? { mrr: 0, arr: 0, overdueCount: 0, churnRate: 0, averageTicket: 0 }
  const charges = data?.charges ?? []

  const kpiCards = [
    { label: 'MRR', value: fmt(kpis.mrr), variation: '', vColor: '#22c55e', icon: TrendingUp, iColor: '#f97316' },
    { label: 'ARR', value: fmt(kpis.arr), variation: '', vColor: '#22c55e', icon: BarChart2, iColor: '#f97316' },
    { label: 'Inadimplentes', value: String(kpis.overdueCount), variation: kpis.overdueCount > 0 ? `${kpis.overdueCount} pendente(s)` : '', vColor: '#f59e0b', icon: AlertCircle, iColor: '#ef4444' },
    { label: 'Churn', value: `${kpis.churnRate}%`, variation: '', vColor: '#22c55e', icon: UserMinus, iColor: 'var(--text-muted)' },
    { label: 'Ticket Médio', value: fmt(kpis.averageTicket), variation: '', vColor: '#22c55e', icon: DollarSign, iColor: '#f97316' },
  ]

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Financeiro</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!tenantId && (
            <div style={{ display: 'flex', gap: 4 }}>
              {periods.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                  borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: period === p.key ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
                  border: `1px solid ${period === p.key ? '#f97316' : 'var(--border)'}`,
                  color: period === p.key ? '#f97316' : 'var(--text-muted)',
                }}>{p.label}</button>
              ))}
            </div>
          )}
          <button onClick={() => setNewChargeModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} strokeWidth={2.2} /> Gerar Nova Cobrança
          </button>
        </div>
      </div>

      {/* KPIs (sempre visíveis — métricas globais) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        {kpiCards.map(k => {
          const I = k.icon
          return (
            <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'relative' }}>
              <I size={18} color={k.iColor} strokeWidth={1.5} style={{ position: 'absolute', top: 16, right: 16 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{k.label}</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{k.value}</span>
              {k.variation && <span style={{ fontSize: 11, color: k.vColor, marginTop: 2, display: 'block' }}>{k.variation}</span>}
            </div>
          )
        })}
      </div>

      {/* Search box (when no tenant selected) */}
      {!tenantId && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20, position: 'relative' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Buscar cliente</label>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ"
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px 10px 36px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={() => runSearch(searchTerm)} disabled={!searchTerm.trim() || searching} style={{ background: searchTerm.trim() ? '#f97316' : 'var(--border)', color: searchTerm.trim() ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '0 22px', fontSize: 13, fontWeight: 600, cursor: searchTerm.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
              {searching && <Loader2 size={14} className="animate-spin" />}
              Buscar
            </button>
          </div>

          {/* Dropdown results */}
          {showResults && (
            <div style={{ position: 'absolute', top: 'calc(100% - 12px)', left: 20, right: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxHeight: 300, overflowY: 'auto', zIndex: 30, marginTop: 8 }}>
              {searching ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Buscando...</div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Nenhum cliente encontrado</div>
              ) : (
                searchResults.map(t => (
                  <div key={t.id} onClick={() => selectTenant(t)} style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}{t.tradeName ? ` (${t.tradeName})` : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>CNPJ: {formatCnpj(t.cnpj)}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Active filter banner (when tenant selected) */}
      {tenantId && selectedTenant && (
        <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Filtrando por cliente</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{selectedTenant.name} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>· {formatCnpj(selectedTenant.cnpj)}</span></div>
          </div>
          <button onClick={clearTenantFilter} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={12} strokeWidth={2} /> Limpar filtro
          </button>
        </div>
      )}

      {/* Charges table OR empty state */}
      {!tenantId && !searchTerm && searchResults.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 60, textAlign: 'center' }}>
          <Search size={32} color="var(--text-muted)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Busque um cliente para ver suas cobranças</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Use o campo de busca acima para localizar pelo nome ou CNPJ</div>
        </div>
      ) : tenantId ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Cobranças</span>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Download size={12} strokeWidth={1.5} /> Exportar CSV
            </button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
              <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando cobranças...</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Empresa', 'Plano', 'Valor Emitido', 'Valor do Desconto', 'Data de Emissão', 'Data de Vencimento', 'Data de Pagamento', 'Status', 'Ações'].map(h => <th key={h} style={thS}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {charges.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Nenhuma cobrança encontrada para este cliente</td></tr>
                  ) : charges.map(c => {
                    const s = statusS[statusKey(c)] ?? statusS.PENDING!
                    const pc = planColors[c.tenant.plan.slug] ?? planColors.solo
                    const disc = c.discountValue !== null && c.discountValue !== undefined ? Number(c.discountValue) : 0
                    const canEdit = c.status === 'PENDING' || c.status === 'OVERDUE'
                    return (
                      <tr key={c.id} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <td style={tdS}>{c.tenant.name}</td>
                        <td style={tdS}><span style={{ background: pc!.bg, color: pc!.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{c.tenant.plan.name}</span></td>
                        <td style={{ ...tdS, fontWeight: 700 }}>{fmt(Number(c.amount))}</td>
                        <td style={{ ...tdS, color: disc > 0 ? '#22c55e' : 'var(--text-muted)' }}>{disc > 0 ? `- ${fmt(disc)}` : '—'}</td>
                        <td style={tdS}>{fmtDate(c.createdAt)}</td>
                        <td style={tdS}>{fmtDate(c.dueDate)}</td>
                        <td style={tdS}>{fmtDate(c.paidAt)}</td>
                        <td style={tdS}><span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{s.label}</span></td>
                        <td style={{ ...tdS, position: 'relative' }}>
                          {canEdit ? (
                            <>
                              <button onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openMenu === c.id ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                <MoreHorizontal size={14} strokeWidth={1.5} />
                              </button>
                              {openMenu === c.id && (
                                <>
                                  <div onClick={() => setOpenMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
                                  <div style={{ position: 'absolute', right: 14, top: '100%', zIndex: 30, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 200, padding: '4px 0', marginTop: 4 }}>
                                    <div onClick={() => { setOpenMenu(null); setUpdateModal(c) }}
                                      style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                      Atualizar Cobrança
                                    </div>
                                    <div onClick={() => { setOpenMenu(null); setChargeModal(c) }}
                                      style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                      Reenviar Cobrança
                                    </div>
                                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                    <div onClick={() => { setOpenMenu(null); handleCancelCharge(c) }}
                                      style={{ padding: '8px 14px', fontSize: 13, color: '#ef4444', cursor: 'pointer' }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                      Cancelar Cobrança
                                    </div>
                                  </div>
                                </>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
            Mostrando {charges.length} cobrança{charges.length !== 1 ? 's' : ''}
          </div>
        </div>
      ) : null}

      {chargeModal && <ChargeNowModal mode="retry" charge={chargeModal} onClose={() => { setChargeModal(null); reload() }} />}
      {newChargeModal && (
        <ChargeNowModal
          mode="create"
          tenantId={tenantId ?? undefined}
          tenantName={selectedTenant?.name}
          onClose={() => { setNewChargeModal(false); reload() }}
          onCreated={() => { showToast('Cobrança gerada'); reload() }}
        />
      )}
      {updateModal && (
        <UpdateChargeModal
          charge={updateModal}
          onClose={() => setUpdateModal(null)}
          onUpdated={() => { setUpdateModal(null); showToast('Cobrança atualizada'); reload() }}
          onResend={() => { const c = updateModal; setUpdateModal(null); setChargeModal(c) }}
        />
      )}
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast}</div>}
    </AppLayout>
  )
}
