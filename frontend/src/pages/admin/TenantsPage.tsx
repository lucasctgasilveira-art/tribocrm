import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, MoreHorizontal, Loader2, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import { getTenants, updateTenant } from '../../services/admin.service'
import api from '../../services/api'

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

const dropdownOptions = ['Visualizar', 'Editar', 'Suspender', 'Estender Trial', 'Ver cobranças', 'Aplicar desconto', 'Registrar observação']

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
  const navigate = useNavigate()
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
  const [newClientModal, setNewClientModal] = useState(false)
  const [editTenant, setEditTenant] = useState<Tenant | null>(null)
  const [discountTenant, setDiscountTenant] = useState<Tenant | null>(null)
  const [noteModal, setNoteModal] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  function reload() { setReloadKey(k => k + 1) }
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

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
  }, [debouncedSearch, statusFilter, activeTab, page, reloadKey])

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
        <button onClick={() => setNewClientModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
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
                            <div key={opt} onClick={async () => {
                              setOpenMenu(null)
                              if (opt === 'Visualizar') navigate(`/admin/clientes/${t.id}`)
                              else if (opt === 'Editar') setEditTenant(t)
                              else if (opt === 'Suspender') { await updateTenant(t.id, { status: t.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' }); showToast(t.status === 'SUSPENDED' ? 'Cliente reativado' : 'Cliente suspenso'); reload() }
                              else if (opt === 'Estender Trial') { const d = new Date(); d.setDate(d.getDate() + 7); await updateTenant(t.id, { trialEndsAt: d.toISOString() }); showToast('Trial estendido em 7 dias'); reload() }
                              else if (opt === 'Ver cobranças') navigate(`/admin/financeiro?tenant=${t.id}`)
                              else if (opt === 'Aplicar desconto') setDiscountTenant(t)
                              else if (opt === 'Registrar observação') setNoteModal(t.id)
                            }}
                              style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Suspender' && t.status !== 'SUSPENDED' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt === 'Suspender' && t.status === 'SUSPENDED' ? 'Reativar' : opt}</div>
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
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast}</div>}
      {newClientModal && <NewClientModal onClose={() => setNewClientModal(false)} onCreated={() => { setNewClientModal(false); reload(); showToast('Cliente criado com sucesso!') }} />}
      {editTenant && <EditTenantModal tenant={editTenant} onClose={() => setEditTenant(null)} onSaved={() => { setEditTenant(null); reload(); showToast('Cliente atualizado!') }} />}
      {discountTenant && <DiscountModal tenant={discountTenant} onClose={() => setDiscountTenant(null)} onSaved={() => { setDiscountTenant(null); showToast('Desconto aplicado!') }} />}
      {noteModal && <NoteModal tenantId={noteModal} onClose={() => setNoteModal(null)} onSaved={() => { setNoteModal(null); showToast('Observação registrada') }} />}
    </AppLayout>
  )
}

// ── New Client Modal ──

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function maskCEP(v: string): string { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d }
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState(''); const [cnpj, setCnpj] = useState(''); const [email, setEmail] = useState(''); const [site, setSite] = useState('')
  const [cep, setCep] = useState(''); const [rua, setRua] = useState(''); const [numero, setNumero] = useState(''); const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState(''); const [estado, setEstado] = useState('')
  const [responsibleName, setResponsibleName] = useState(''); const [fundacao, setFundacao] = useState('')
  const [planId, setPlanId] = useState(''); const [cycle, setCycle] = useState('MONTHLY'); const [payMethod, setPayMethod] = useState('PIX')
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [cepLoading, setCepLoading] = useState(false)
  const iS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const canSave = name.trim() && cnpj.replace(/\D/g, '').length === 14 && email.trim() && responsibleName.trim() && planId

  useState(() => { api.get('/payments/plans').then(r => { const p = r.data.data; setPlans(p); if (p.length) setPlanId(p[0].id) }).catch(() => {}) })

  async function buscarCep() {
    const c = cep.replace(/\D/g, ''); if (c.length !== 8) return
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (!d.erro) { setRua(d.logradouro ?? ''); setBairro(d.bairro ?? ''); setCidade(d.localidade ?? ''); setEstado(d.uf ?? '') }
    } catch {/**/}
    setCepLoading(false)
  }

  async function handleSave() {
    if (!canSave) return; setSaving(true); setError('')
    try {
      await api.post('/admin/tenants', { name, cnpj: cnpj.replace(/\D/g, ''), email, site, responsibleName, fundacao, planId, planCycle: cycle, paymentMethod: payMethod, address: { cep: cep.replace(/\D/g, ''), street: rua, number: numero, complement: complemento, neighborhood: bairro, city: cidade, state: estado } })
      onCreated()
    } catch (e: any) { setError(e.response?.data?.error?.message ?? 'Erro ao criar cliente'); setSaving(false) }
  }

  function Lbl({ children, req }: { children: string; req?: boolean }) { return <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{children}{req && <span style={{ color: '#f97316' }}> *</span>}</label> }
  function Sec({ children }: { children: string }) { return <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: 10, marginTop: 16 }}>{children}</div> }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 640, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Cliente</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <Sec>Dados da empresa</Sec>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Lbl req>Nome da empresa</Lbl><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Empresa ABC Ltda" style={iS} /></div>
            <div><Lbl req>CNPJ</Lbl><input value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} placeholder="00.000.000/0001-00" style={iS} /></div>
            <div><Lbl req>E-mail</Lbl><input value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com" type="email" style={iS} /></div>
            <div><Lbl>Site</Lbl><input value={site} onChange={e => setSite(e.target.value)} placeholder="https://" style={iS} /></div>
          </div>

          <Sec>Endereço</Sec>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 160 }}><Lbl>CEP</Lbl><input value={cep} onChange={e => setCep(maskCEP(e.target.value))} placeholder="00000-000" style={iS} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={buscarCep} disabled={cepLoading} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{cepLoading ? '...' : 'Buscar'}</button></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><Lbl>Rua</Lbl><input value={rua} onChange={e => setRua(e.target.value)} style={iS} /></div>
            <div><Lbl>Número</Lbl><input value={numero} onChange={e => setNumero(e.target.value)} style={iS} /></div>
            <div><Lbl>Complemento</Lbl><input value={complemento} onChange={e => setComplemento(e.target.value)} style={iS} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
            <div><Lbl>Bairro</Lbl><input value={bairro} onChange={e => setBairro(e.target.value)} style={iS} /></div>
            <div><Lbl>Cidade</Lbl><input value={cidade} onChange={e => setCidade(e.target.value)} style={iS} /></div>
            <div><Lbl>UF</Lbl><select value={estado} onChange={e => setEstado(e.target.value)} style={{ ...iS, appearance: 'none' as const, cursor: 'pointer' }}><option value="">--</option>{UFS.map(u => <option key={u}>{u}</option>)}</select></div>
          </div>

          <Sec>Responsável</Sec>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Lbl req>Nome do responsável</Lbl><input value={responsibleName} onChange={e => setResponsibleName(e.target.value)} placeholder="Nome do gestor" style={iS} /></div>
            <div><Lbl>Data de fundação</Lbl><input type="date" value={fundacao} onChange={e => setFundacao(e.target.value)} style={iS} /></div>
          </div>

          <Sec>Plano e pagamento</Sec>
          <div style={{ marginBottom: 12 }}><Lbl req>Plano</Lbl><select value={planId} onChange={e => setPlanId(e.target.value)} style={{ ...iS, appearance: 'none' as const, cursor: 'pointer' }}>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Lbl>Ciclo</Lbl>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ k: 'MONTHLY', l: 'Mensal' }, { k: 'YEARLY', l: 'Anual (-15%)' }].map(c => (
                  <label key={c.k} onClick={() => setCycle(c.k)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${cycle === c.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cycle === c.k && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}</div>{c.l}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Lbl>Pagamento</Lbl>
              <div style={{ display: 'flex', gap: 8 }}>
                {['PIX', 'Boleto', 'Cartão'].map(m => (
                  <label key={m} onClick={() => setPayMethod(m)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${payMethod === m ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{payMethod === m && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}</div>{m}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave || saving} style={{ background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Criando...' : 'Criar cliente'}
          </button>
        </div>
      </div>
    </>
  )
}

function DiscountModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: () => void }) {
  const [discountType, setDiscountType] = useState('PERCENT')
  const [discountValue, setDiscountValue] = useState('')
  const [applyImmediately, setApplyImmediately] = useState(true)
  const [cycles, setCycles] = useState('1')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const iS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    if (!discountValue) return; setSaving(true)
    try {
      await api.post(`/admin/tenants/${tenant.id}/discount`, { discountType, discountValue: parseFloat(discountValue), discountCycles: parseInt(cycles) || 0, discountReason: reason, applyImmediately })
      onSaved()
    } catch { setSaving(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 460, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Desconto Manual — {tenant.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tipo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ k: 'PERCENT', l: '%' }, { k: 'FIXED', l: 'R$' }].map(t => (
                  <label key={t.k} onClick={() => setDiscountType(t.k)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${discountType === t.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{discountType === t.k && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />}</div>{t.l}
                  </label>
                ))}
              </div>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Valor *</label><input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'PERCENT' ? 'Ex: 20' : 'Ex: 50'} style={iS} /></div>
          </div>
          <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Aplicar</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ k: true, l: 'Imediatamente' }, { k: false, l: 'Na próxima renovação' }].map(a => (
                <label key={String(a.k)} onClick={() => setApplyImmediately(a.k)} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${applyImmediately === a.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{applyImmediately === a.k && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />}</div>{a.l}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Por quantos ciclos (0 = recorrente)</label><input type="number" value={cycles} onChange={e => setCycles(e.target.value)} style={{ ...iS, width: 100 }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Motivo (uso interno)</label><textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Negociação comercial" style={{ ...iS, resize: 'none' }} /></div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!discountValue || saving} style={{ background: discountValue ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: discountValue ? '#fff' : 'var(--text-muted)', cursor: discountValue ? 'pointer' : 'not-allowed' }}>Aplicar desconto</button>
        </div>
      </div>
    </>
  )
}

function NoteModal({ tenantId, onClose, onSaved }: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  async function handleSave() {
    if (!note.trim()) return
    setSaving(true)
    try { await updateTenant(tenantId, { internalNotes: note }); onSaved() } catch { setSaving(false) }
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Registrar observação</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Escreva uma observação sobre este cliente..." style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!note.trim() || saving} style={{ background: note.trim() ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: note.trim() ? '#fff' : 'var(--text-muted)', cursor: note.trim() ? 'pointer' : 'not-allowed' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </>
  )
}

function EditTenantModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tenant.name)
  const [email, setEmail] = useState(tenant.email)
  const [status, setStatus] = useState(tenant.status)
  const [planId, setPlanId] = useState(tenant.plan.id)
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([])
  const [cycle, setCycle] = useState('MONTHLY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const iS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  useState(() => { api.get('/payments/plans').then(r => setPlans(r.data.data)).catch(() => {}) })

  async function handleSave() {
    setSaving(true); setError('')
    try { await updateTenant(tenant.id, { name, email, status, planId }); onSaved() }
    catch (e: any) { setError(e.response?.data?.error?.message ?? 'Erro ao salvar'); setSaving(false) }
  }

  function Lbl({ children }: { children: string }) { return <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{children}</label> }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Editar — {tenant.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 16 }}><Lbl>Nome da empresa</Lbl><input value={name} onChange={e => setName(e.target.value)} style={iS} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><Lbl>CNPJ</Lbl><input value={tenant.cnpj} disabled style={{ ...iS, opacity: 0.6, cursor: 'not-allowed' }} /></div>
            <div><Lbl>E-mail</Lbl><input value={email} onChange={e => setEmail(e.target.value)} style={iS} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><Lbl>Plano</Lbl>
              <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ ...iS, appearance: 'none' as const, cursor: 'pointer' }}>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Lbl>Status</Lbl>
              <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...iS, appearance: 'none' as const, cursor: 'pointer' }}>
                <option value="ACTIVE">Ativo</option><option value="TRIAL">Trial</option><option value="SUSPENDED">Suspenso</option><option value="CANCELLED">Cancelado</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}><Lbl>Ciclo</Lbl>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ k: 'MONTHLY', l: 'Mensal' }, { k: 'YEARLY', l: 'Anual (-15%)' }].map(c => (
                <label key={c.k} onClick={() => setCycle(c.k)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${cycle === c.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cycle === c.k && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}</div>{c.l}
                </label>
              ))}
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </>
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
