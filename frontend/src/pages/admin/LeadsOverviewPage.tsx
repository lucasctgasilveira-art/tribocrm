import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2, Download, Users, Building2, Target, TrendingUp, CheckCircle2, XCircle, Archive, type LucideIcon } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import {
  getLeadsOverview, getTenantsForFilter, exportLeadsCsv,
  type LeadsOverviewData, type LeadsOverviewFilters,
  type ClientFilter, type SellerFilter, type LeadFilter,
  type AdminTenantOption,
} from '../../services/admin.service'
import { getPeriodOptions, currentPeriodValue, type AggregationPeriod } from '../../utils/goalMonths'

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function fmtNumber(v: number): string {
  return v.toLocaleString('pt-BR')
}

export default function LeadsOverviewPage() {
  const [data, setData] = useState<LeadsOverviewData | null>(null)
  const [tenants, setTenants] = useState<AdminTenantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  // Filtros
  const [tenantId, setTenantId] = useState<string>('all')
  const [tenantSearch, setTenantSearch] = useState('')
  const [clientStatus, setClientStatus] = useState<ClientFilter>('active')
  const [sellerStatus, setSellerStatus] = useState<SellerFilter>('all')
  const [leadStatus, setLeadStatus] = useState<LeadFilter>('all')
  const [periodType, setPeriodType] = useState<AggregationPeriod>('MONTHLY')
  const [periodRef, setPeriodRef] = useState<string>(currentPeriodValue('MONTHLY'))

  const filters = useMemo<LeadsOverviewFilters>(() => ({
    tenantId: tenantId === 'all' ? undefined : tenantId,
    clientStatus,
    sellerStatus,
    leadStatus,
    periodType,
    periodReference: periodRef,
  }), [tenantId, clientStatus, sellerStatus, leadStatus, periodType, periodRef])

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await getLeadsOverview(filters)
      setData(result)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    getTenantsForFilter().then(setTenants).catch(() => setTenants([]))
  }, [])

  function handlePeriodTypeChange(t: AggregationPeriod) {
    setPeriodType(t)
    setPeriodRef(currentPeriodValue(t))
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportLeadsCsv(filters)
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao exportar CSV')
    } finally {
      setExporting(false)
    }
  }

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase()
    if (!q) return tenants
    return tenants.filter(t => t.name.toLowerCase().includes(q))
  }, [tenants, tenantSearch])

  return (
    <AppLayout menuItems={adminMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Leads — Visão consolidada</h1>
        <button onClick={handleExport} disabled={exporting || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f97316', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1,
          }}>
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={1.5} />}
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <FilterSelect label="Cliente — busca">
            <input
              value={tenantSearch}
              onChange={e => setTenantSearch(e.target.value)}
              placeholder="Filtrar lista..."
              style={inputS}
            />
          </FilterSelect>
          <FilterSelect label="Cliente">
            <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={selectS}>
              <option value="all">Todos os clientes</option>
              {filteredTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </FilterSelect>
          <FilterSelect label="Status do cliente">
            <select value={clientStatus} onChange={e => setClientStatus(e.target.value as ClientFilter)} style={selectS}>
              <option value="all">Todos</option>
              <option value="active">Ativos (ACTIVE+TRIAL)</option>
              <option value="inactive">Inativos</option>
            </select>
          </FilterSelect>
          <FilterSelect label="Status do vendedor">
            <select value={sellerStatus} onChange={e => setSellerStatus(e.target.value as SellerFilter)} style={selectS}>
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </FilterSelect>
          <FilterSelect label="Status do lead">
            <select value={leadStatus} onChange={e => setLeadStatus(e.target.value as LeadFilter)} style={selectS}>
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Vendidos + Perdidos</option>
              <option value="archived">Arquivados</option>
            </select>
          </FilterSelect>
          <FilterSelect label="Tipo de período">
            <select value={periodType} onChange={e => handlePeriodTypeChange(e.target.value as AggregationPeriod)} style={selectS}>
              <option value="MONTHLY">Mensal</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="SEMESTRAL">Semestral</option>
              <option value="YEARLY">Anual</option>
            </select>
          </FilterSelect>
          <FilterSelect label="Período">
            <select value={periodRef} onChange={e => setPeriodRef(e.target.value)} style={selectS}>
              {getPeriodOptions(periodType).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterSelect>
        </div>
      </div>

      {/* Loading / Error / Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando dados...</span>
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 8, padding: 16, fontSize: 13, color: '#ef4444' }}>{error}</div>
      ) : data ? (
        <>
          {/* Cards grupo 1: Clientes + Vendedores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
            <KpiCard
              icon={Building2} iconColor="#3b82f6"
              label="Clientes ativos" value={fmtNumber(data.clients.active)}
              hint={`${fmtNumber(data.clients.inactive)} inativos`}
            />
            <KpiCard
              icon={Users} iconColor="#a855f7"
              label="Vendedores ativos" value={fmtNumber(data.sellers.active)}
              hint={`${fmtNumber(data.sellers.inactive)} inativos`}
            />
          </div>

          {/* Cards grupo 2: Leads por status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <KpiCard
              icon={Target} iconColor="#f97316"
              label="Leads ativos" value={fmtNumber(data.leads.active)}
            />
            <KpiCard
              icon={CheckCircle2} iconColor="#22c55e"
              label="Vendidos" value={fmtNumber(data.leads.won)}
            />
            <KpiCard
              icon={XCircle} iconColor="#ef4444"
              label="Perdidos" value={fmtNumber(data.leads.lost)}
            />
            <KpiCard
              icon={Archive} iconColor="#6b7280"
              label="Arquivados" value={fmtNumber(data.leads.archived)}
            />
          </div>

          {/* Cards grupo 3: Valores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <KpiCard
              icon={TrendingUp} iconColor="#f59e0b"
              label="Em negociação" value={fmt(data.revenue.inNegotiation)}
              hint="Soma do valor esperado de leads ativos"
            />
            <KpiCard
              icon={TrendingUp} iconColor="#22c55e"
              label="Receita finalizada" value={fmt(data.revenue.finalized)}
              hint="Soma de vendas fechadas no período"
            />
          </div>
        </>
      ) : null}
    </AppLayout>
  )
}

// ── Sub-components ──

const inputS: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}
const selectS: React.CSSProperties = { ...inputS, appearance: 'none' as const, cursor: 'pointer' }

function FilterSelect({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function KpiCard({ icon: Icon, iconColor, label, value, hint }: {
  icon: LucideIcon
  iconColor: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, position: 'relative' }}>
      <Icon size={18} color={iconColor} strokeWidth={1.5} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}
