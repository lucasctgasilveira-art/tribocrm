import { useState, useMemo } from 'react'
import { Search, Plus, MoreHorizontal } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

// ── Types ──

type TenantStatus = 'active' | 'trial' | 'overdue' | 'suspended' | 'cancelled'
type PlanSlug = 'solo' | 'essencial' | 'pro' | 'enterprise'

interface Tenant {
  id: string
  initials: string
  name: string
  email: string
  plan: PlanSlug
  status: TenantStatus
  statusLabel: string
  users: string
  leads: number
  nextCharge: string
  mrr: string
}

// ── Config ──

const statusConfig: Record<TenantStatus, { bg: string; color: string }> = {
  active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  trial: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  overdue: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  suspended: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  cancelled: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
}

const planConfig: Record<PlanSlug, { bg: string; color: string; label: string }> = {
  solo: { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', label: 'Solo' },
  essencial: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Essencial' },
  pro: { bg: 'rgba(249,115,22,0.12)', color: '#f97316', label: 'Pro' },
  enterprise: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: 'Enterprise' },
}

const tabFilters: { key: TenantStatus | 'all'; label: string; count: number }[] = [
  { key: 'all', label: 'Todos', count: 174 },
  { key: 'active', label: 'Ativos', count: 142 },
  { key: 'trial', label: 'Trial', count: 28 },
  { key: 'overdue', label: 'Inadimplentes', count: 4 },
  { key: 'suspended', label: 'Suspensos', count: 8 },
  { key: 'cancelled', label: 'Cancelados', count: 22 },
]

const dropdownOptions = ['Visualizar', 'Editar', 'Suspender', 'Estender Trial', 'Ver cobranças', 'Registrar observação']

// ── Mock Data ──

const mockTenants: Tenant[] = [
  { id: '1', initials: 'MN', name: 'MendesNet', email: 'contato@mendesnet.com', plan: 'pro', status: 'active', statusLabel: 'Ativo', users: '8/10', leads: 1240, nextCharge: '05/04/2026', mrr: 'R$ 349' },
  { id: '2', initials: 'TF', name: 'Torres & Filhos', email: 'admin@torres.com', plan: 'essencial', status: 'trial', statusLabel: 'Trial 12d', users: '3/5', leads: 87, nextCharge: 'Trial expira 01/04', mrr: '—' },
  { id: '3', initials: 'GT', name: 'GomesTech', email: 'ti@gomestech.com', plan: 'enterprise', status: 'active', statusLabel: 'Ativo', users: '24/50', leads: 8430, nextCharge: '10/04/2026', mrr: 'R$ 649' },
  { id: '4', initials: 'BC', name: 'Bastos & Co', email: 'bastos@bastos.com', plan: 'solo', status: 'suspended', statusLabel: 'Suspenso 7d', users: '1/1', leads: 312, nextCharge: 'Venceu 21/03', mrr: 'R$ 69' },
  { id: '5', initials: 'LD', name: 'Lima Distribuidora', email: 'lima@limadist.com', plan: 'essencial', status: 'active', statusLabel: 'Ativo', users: '4/5', leads: 654, nextCharge: '18/04/2026', mrr: 'R$ 197' },
  { id: '6', initials: 'SC', name: 'Souza Commerce', email: 'ti@souza.com', plan: 'pro', status: 'overdue', statusLabel: 'Inadimplente', users: '6/10', leads: 2100, nextCharge: 'Venceu 01/04', mrr: 'R$ 349' },
  { id: '7', initials: 'RV', name: 'Ribeiro Vendas', email: 'ribeiro@rv.com', plan: 'solo', status: 'active', statusLabel: 'Ativo', users: '1/1', leads: 89, nextCharge: '22/04/2026', mrr: 'R$ 69' },
  { id: '8', initials: 'AM', name: 'Alpha Marketing', email: 'ceo@alpha.com', plan: 'pro', status: 'trial', statusLabel: 'Trial 5d', users: '2/10', leads: 12, nextCharge: 'Trial expira 08/04', mrr: '—' },
  { id: '9', initials: 'PS', name: 'Prime Solutions', email: 'admin@prime.com', plan: 'enterprise', status: 'active', statusLabel: 'Ativo', users: '18/50', leads: 5670, nextCharge: '30/04/2026', mrr: 'R$ 649' },
  { id: '10', initials: 'CD', name: 'Costa Digital', email: 'contato@costa.com', plan: 'essencial', status: 'cancelled', statusLabel: 'Cancelado', users: '0/5', leads: 234, nextCharge: 'Cancelado 15/03', mrr: '—' },
]

// ── Helpers ──

const selectStyle: React.CSSProperties = {
  background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
  padding: '0 28px 0 12px', fontSize: 13, color: '#e8eaf0', outline: 'none',
  height: 36, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

// ── Component ──

export default function TenantsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [activeTab, setActiveTab] = useState<TenantStatus | 'all'>('all')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return mockTenants.filter((t) => {
      const q = search.toLowerCase()
      if (q && !t.name.toLowerCase().includes(q) && !t.email.toLowerCase().includes(q)) return false
      if (statusFilter && t.status !== statusFilter) return false
      if (planFilter && t.plan !== planFilter) return false
      if (activeTab !== 'all' && t.status !== activeTab) return false
      return true
    })
  }, [search, statusFilter, planFilter, activeTab])

  return (
    <AppLayout menuItems={adminMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Clientes</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Gerencie os clientes da plataforma</p>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f97316', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}
        >
          <Plus size={16} strokeWidth={2} />
          Novo Cliente
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <StatItem label="Ativos" value="142" color="#22c55e" />
        <StatSep />
        <StatItem label="Em Trial" value="28" color="#3b82f6" />
        <StatSep />
        <StatItem label="Inadimplentes" value="4" color="#ef4444" />
        <StatSep />
        <StatItem label="MRR" value="R$ 42.180" color="#f97316" />
        <StatSep />
        <StatItem label="Novos este mês" value="+12" color="#22c55e" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={15} color="#6b7280" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
            style={{ width: '100%', background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: '#e8eaf0', outline: 'none', height: 36, boxSizing: 'border-box' }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">Status</option>
          <option value="active">Ativo</option>
          <option value="trial">Trial</option>
          <option value="overdue">Inadimplente</option>
          <option value="suspended">Suspenso</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={selectStyle}>
          <option value="">Plano</option>
          <option value="solo">Solo</option>
          <option value="essencial">Essencial</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabFilters.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
                background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(249,115,22,0.3)' : '#22283a'}`,
                color: isActive ? '#f97316' : '#6b7280',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f1117' }}>
              {['Empresa', 'Plano', 'Status', 'Usuários', 'Leads', 'Próx. cobrança', 'MRR', 'Ações'].map((h) => (
                <th key={h} style={{ padding: '12px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const sc = statusConfig[t.status]
              const pc = planConfig[t.plan]
              const isHovered = hoveredRow === t.id
              return (
                <tr
                  key={t.id}
                  onMouseEnter={() => setHoveredRow(t.id)}
                  onMouseLeave={() => setHoveredRow(t.id === hoveredRow ? null : hoveredRow)}
                  style={{ borderBottom: '1px solid #22283a', background: isHovered ? 'rgba(255,255,255,0.02)' : 'transparent', transition: 'background 0.1s' }}
                >
                  {/* Empresa */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#22283a', fontSize: 11, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {t.initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{t.email}</div>
                      </div>
                    </div>
                  </td>
                  {/* Plano */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ background: pc.bg, color: pc.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{pc.label}</span>
                  </td>
                  {/* Status */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{t.statusLabel}</span>
                  </td>
                  {/* Usuários */}
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{t.users}</td>
                  {/* Leads */}
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#e8eaf0' }}>{t.leads.toLocaleString('pt-BR')}</td>
                  {/* Próx cobrança */}
                  <td style={{ padding: '14px 20px', fontSize: 12, color: t.nextCharge.includes('Venceu') || t.nextCharge.includes('Cancelado') ? '#ef4444' : t.nextCharge.includes('Trial') ? '#3b82f6' : '#9ca3af', whiteSpace: 'nowrap' }}>
                    {t.nextCharge}
                  </td>
                  {/* MRR */}
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500, color: t.mrr === '—' ? '#6b7280' : '#e8eaf0' }}>{t.mrr}</td>
                  {/* Ações */}
                  <td style={{ padding: '14px 20px', position: 'relative' }}>
                    <button
                      onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        border: '1px solid #22283a', background: openMenu === t.id ? '#22283a' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#9ca3af', transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { if (openMenu !== t.id) e.currentTarget.style.background = '#22283a' }}
                      onMouseLeave={(e) => { if (openMenu !== t.id) e.currentTarget.style.background = 'transparent' }}
                    >
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </button>
                    {openMenu === t.id && (
                      <div
                        style={{
                          position: 'absolute', right: 20, top: 48, zIndex: 20,
                          background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 180, padding: '4px 0',
                        }}
                      >
                        {dropdownOptions.map((opt) => (
                          <div
                            key={opt}
                            onClick={() => setOpenMenu(null)}
                            style={{
                              padding: '8px 14px', fontSize: 13, color: '#e8eaf0', cursor: 'pointer',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Footer / Pagination */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Mostrando 1-{filtered.length} de 174 clientes</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <PaginationBtn label="Anterior" disabled />
            <PaginationBtn label="Próximo" disabled={false} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

// ── Sub-components ──

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function StatSep() {
  return <div style={{ width: 1, height: 20, background: '#22283a' }} />
}

function PaginationBtn({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button
      disabled={disabled}
      style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6,
        border: '1px solid #22283a', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'transparent' : '#161a22',
        color: disabled ? '#6b7280' : '#e8eaf0',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}
