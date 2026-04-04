import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, MoreHorizontal, Kanban, List, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import NewLeadModal, { type NewLeadData } from '../../components/shared/NewLeadModal/NewLeadModal'
import ImportLeadsModal from '../../components/shared/ImportLeadsModal/ImportLeadsModal'
import LeadDrawer from '../../components/shared/LeadDrawer/LeadDrawer'
import { getLeads, createLead } from '../../services/leads.service'
import { getPipelines } from '../../services/pipeline.service'

// ── Types ──

interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  expectedValue: string | number | null
  temperature: 'HOT' | 'WARM' | 'COLD'
  status: string
  lastActivityAt: string | null
  updatedAt: string
  stage: { id: string; name: string; color: string }
  responsible: { id: string; name: string }
}

interface Meta {
  total: number
  page: number
  perPage: number
  totalPages: number
}

interface PipelineOption {
  id: string
  name: string
  stages: { id: string; name: string; color: string }[]
}

// ── Config ──

const tempDisplay: Record<string, { label: string; color: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316' },
  WARM: { label: '🌤 Morno', color: '#f59e0b' },
  COLD: { label: '❄️ Frio', color: '#3b82f6' },
}

const menuOpts = ['Ver detalhes', 'Editar', 'Mover etapa', 'Arquivar']

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

const dd: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 28px 0 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36,
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

// ── Component ──

export default function GestaoLeadsPage() {
  const navigate = useNavigate()

  // Data state
  const [leads, setLeads] = useState<Lead[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, perPage: 20, totalPages: 0 })
  const [pipelines, setPipelines] = useState<PipelineOption[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pipelineId, setPipelineId] = useState<string>('')
  const [stageId, setStageId] = useState<string>('')
  const [temperature, setTemperature] = useState<string>('')
  const [tab, setTab] = useState<'all' | 'active' | 'archived'>('all')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('recent')

  // UI state
  const [menu, setMenu] = useState<string | null>(null)
  const [hov, setHov] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null)

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 500)
  }, [])

  // Load pipelines on mount
  useEffect(() => {
    getPipelines().then((data: PipelineOption[]) => setPipelines(data)).catch(() => {})
  }, [])

  // Compute status filter from tab
  const statusFilter = useMemo(() => {
    if (tab === 'active') return 'ACTIVE'
    if (tab === 'archived') return ''
    return ''
  }, [tab])

  // Load leads when filters change
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, perPage: 20 }
        if (debouncedSearch) params.search = debouncedSearch
        if (pipelineId) params.pipelineId = pipelineId
        if (stageId) params.stageId = stageId
        if (temperature) params.temperature = temperature
        if (statusFilter) params.status = statusFilter
        const result = await getLeads(params)
        setLeads(result.data)
        setMeta(result.meta)
      } catch {
        setLeads([])
        setMeta({ total: 0, page: 1, perPage: 20, totalPages: 0 })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [debouncedSearch, pipelineId, stageId, temperature, statusFilter, page])

  // Available stages based on selected pipeline
  const stageOptions = useMemo(() => {
    if (!pipelineId) {
      const allStages: { id: string; name: string }[] = []
      pipelines.forEach(p => p.stages?.forEach(s => {
        if (!allStages.find(x => x.name === s.name)) allStages.push(s)
      }))
      return allStages
    }
    const p = pipelines.find(p => p.id === pipelineId)
    return p?.stages ?? []
  }, [pipelines, pipelineId])

  // Sorted leads (client-side sort on current page)
  const sortedLeads = useMemo(() => {
    const arr = [...leads]
    if (sortBy === 'value') arr.sort((a, b) => (Number(b.expectedValue) || 0) - (Number(a.expectedValue) || 0))
    if (sortBy === 'name') arr.sort((a, b) => a.name.localeCompare(b.name))
    return arr
  }, [leads, sortBy])

  // Stats from meta
  const totalHot = leads.filter(l => l.temperature === 'HOT').length
  const totalValue = leads.reduce((s, l) => s + (Number(l.expectedValue) || 0), 0)

  function exportData(type: 'xlsx' | 'csv') {
    const header = 'Nome,Empresa,Etapa,Temperatura,Valor,Responsável,Última Atividade'
    const rows = leads.map(l => `${l.name},${l.company ?? ''},${l.stage.name},${l.temperature},${Number(l.expectedValue) || 0},${l.responsible.name},${formatTimeAgo(l.lastActivityAt)}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url; a.download = `leads_export_${date}.${type}`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleNewLead(data: NewLeadData) {
    try {
      const selectedPipeline = pipelines[0]
      if (!selectedPipeline) return

      const stage = selectedPipeline.stages?.find(s => s.name === data.stage) ?? selectedPipeline.stages?.[0]
      if (!stage) return

      const tempMap: Record<string, string> = { Quente: 'HOT', Morno: 'WARM', Frio: 'COLD' }

      await createLead({
        name: data.name,
        company: data.company || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        expectedValue: parseInt(data.value) || undefined,
        pipelineId: selectedPipeline.id,
        stageId: stage.id,
        temperature: tempMap[data.temperature] ?? 'WARM',
      })

      setModalOpen(false)
      setPage(1)
      // Trigger reload
      setDebouncedSearch(prev => prev + '')
    } catch {
      // Error handled by interceptor
    }
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Leads</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => navigate('/gestao/pipeline')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Kanban size={14} strokeWidth={1.5} /> Kanban
            </button>
            <button style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'default', border: '1px solid #f97316', background: 'rgba(249,115,22,0.12)', color: '#f97316', display: 'flex', alignItems: 'center', gap: 4 }}>
              <List size={14} strokeWidth={1.5} /> Lista
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setImportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
            <Download size={15} strokeWidth={1.5} /> Importar
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setExportOpen(!exportOpen)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
              <Download size={15} strokeWidth={1.5} /> Exportar
            </button>
            {exportOpen && (
              <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 200, padding: '4px 0' }}>
                <div onClick={() => { exportData('xlsx'); setExportOpen(false) }} style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <FileSpreadsheet size={15} color="#22c55e" strokeWidth={1.5} /> Exportar Excel (.xlsx)
                </div>
                <div onClick={() => { exportData('csv'); setExportOpen(false) }} style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <FileText size={15} color="var(--text-secondary)" strokeWidth={1.5} /> Exportar CSV (.csv)
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}>
            <Plus size={15} strokeWidth={2} /> Novo Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{meta.total}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Valor na página</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{fmt(totalValue)}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Quentes</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>🔥 {totalHot}</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
          <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nome ou empresa..."
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36, boxSizing: 'border-box' }} />
        </div>
        <select value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStageId(''); setPage(1) }} style={dd}>
          <option value="">Pipeline</option>
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={stageId} onChange={(e) => { setStageId(e.target.value); setPage(1) }} style={dd}>
          <option value="">Etapa</option>
          {stageOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={temperature} onChange={(e) => { setTemperature(e.target.value); setPage(1) }} style={dd}>
          <option value="">Temperatura</option>
          <option value="HOT">Quente</option>
          <option value="WARM">Morno</option>
          <option value="COLD">Frio</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={dd}>
          <option value="recent">Mais recente</option>
          <option value="value">Maior valor</option>
          <option value="name">Nome A-Z</option>
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([['all', 'Todos'], ['active', 'Ativos'], ['archived', 'Arquivados']] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setPage(1) }} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13,
            color: tab === k ? '#f97316' : 'var(--text-muted)', fontWeight: tab === k ? 500 : 400,
            borderBottom: tab === k ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando leads...</span>
        </div>
      ) : (
        /* Table */
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Lead', 'Etapa', 'Temperatura', 'Valor', 'Responsável', 'Última atividade', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    Nenhum lead encontrado
                  </td>
                </tr>
              ) : sortedLeads.map((l) => {
                const sc = l.stage.color
                const td = tempDisplay[l.temperature]
                return (
                  <tr key={l.id}
                    onClick={() => { if (menu !== l.id) setDrawerLead(l) }}
                    onMouseEnter={() => setHov(l.id)}
                    onMouseLeave={() => setHov(null)}
                    style={{ borderBottom: '1px solid var(--border)', background: drawerLead?.id === l.id ? 'rgba(249,115,22,0.06)' : hov === l.id ? 'var(--bg-elevated)' : 'transparent', cursor: 'pointer', transition: 'background 0.1s', borderLeft: drawerLead?.id === l.id ? '2px solid #f97316' : '2px solid transparent' }}>
                    {/* Lead */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(l.name)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{l.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.company ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    {/* Etapa */}
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: `${sc}1F`, color: sc, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{l.stage.name}</span>
                    </td>
                    {/* Temperatura */}
                    <td style={{ padding: '14px 20px', fontSize: 12, color: td?.color ?? 'var(--text-muted)' }}>{td?.label ?? l.temperature}</td>
                    {/* Valor */}
                    <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(Number(l.expectedValue) || 0)}</td>
                    {/* Responsável */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(l.responsible.name)}</div>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.responsible.name}</span>
                      </div>
                    </td>
                    {/* Última atividade */}
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{formatTimeAgo(l.lastActivityAt)}</td>
                    {/* Ações */}
                    <td style={{ padding: '14px 20px', position: 'relative' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenu(menu === l.id ? null : l.id) }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: menu === l.id ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { if (menu !== l.id) e.currentTarget.style.background = 'var(--border)' }}
                        onMouseLeave={(e) => { if (menu !== l.id) e.currentTarget.style.background = 'transparent' }}>
                        <MoreHorizontal size={14} strokeWidth={1.5} />
                      </button>
                      {menu === l.id && (
                        <div style={{ position: 'absolute', right: 20, top: 48, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 160, padding: '4px 0' }}>
                          {menuOpts.map(opt => (
                            <div key={opt}
                              onClick={(e) => { e.stopPropagation(); setMenu(null); if (opt === 'Ver detalhes') setDrawerLead(l) }}
                              style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
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

          {/* Pagination */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Mostrando {leads.length === 0 ? 0 : (meta.page - 1) * meta.perPage + 1}-{Math.min(meta.page * meta.perPage, meta.total)} de {meta.total} leads
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border)', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'transparent', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page <= 1 ? 0.5 : 1 }}>
                Anterior
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border)', cursor: page >= meta.totalPages ? 'not-allowed' : 'pointer', background: 'var(--bg-card)', color: page >= meta.totalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page >= meta.totalPages ? 0.5 : 1 }}>
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}

      <NewLeadModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleNewLead} />
      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} />
      {drawerLead && (
        <LeadDrawer
          lead={{
            id: drawerLead.id, name: drawerLead.name, company: drawerLead.company ?? '',
            value: Number(drawerLead.expectedValue) || 0, stage: drawerLead.stage.name,
            temperature: drawerLead.temperature,
            responsible: ini(drawerLead.responsible.name),
            lastContact: formatTimeAgo(drawerLead.lastActivityAt),
            phone: drawerLead.phone ?? drawerLead.whatsapp ?? '—', email: drawerLead.email ?? '—',
          }}
          onClose={() => setDrawerLead(null)}
          stageColor={drawerLead.stage.color}
          instance="gestao"
        />
      )}
    </AppLayout>
  )
}
