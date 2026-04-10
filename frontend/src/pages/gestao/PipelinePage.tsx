import { useState, useEffect, useMemo, useCallback, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MessageCircle, Mail, Phone, Plus, Kanban as KanbanIcon, List, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import LeadDrawer from '../../components/shared/LeadDrawer/LeadDrawer'
import NewLeadModal, { type NewLeadData } from '../../components/shared/NewLeadModal/NewLeadModal'
import { getPipelines, getKanban } from '../../services/pipeline.service'
import api from '../../services/api'

// ── Types ──

type Temperature = 'HOT' | 'WARM' | 'COLD'

interface Lead {
  id: string
  name: string
  company: string
  value: number
  stage: string
  temperature: Temperature
  responsible: string
  lastContact: string | null
  phone: string
  email: string
}

interface StageConfig { id: string; name: string; color: string; position: number }

interface ApiLead {
  id: string
  name: string
  company: string | null
  phone: string | null
  whatsapp: string | null
  expectedValue: string | number | null
  temperature: Temperature
  stageId: string
  lastActivityAt: string | null
  responsible: { id: string; name: string }
}

interface KanbanStage {
  id: string
  name: string
  color: string
  position: number
  leads: ApiLead[]
}

interface KanbanData {
  pipeline: { id: string; name: string }
  stages: KanbanStage[]
}

interface PipelineItem {
  id: string
  name: string
}

// ── Config ──

const tempConfig: Record<Temperature, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

type FilterChip = 'mine' | 'hot' | 'cold' | 'overdue' | 'stale'

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function formatTimeAgo(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function mapApiLeadToLead(apiLead: ApiLead, stageName: string): Lead {
  return {
    id: apiLead.id,
    name: apiLead.name,
    company: apiLead.company ?? '',
    value: Number(apiLead.expectedValue) || 0,
    stage: stageName,
    temperature: apiLead.temperature,
    responsible: getInitials(apiLead.responsible.name),
    lastContact: formatTimeAgo(apiLead.lastActivityAt),
    phone: apiLead.phone ?? apiLead.whatsapp ?? '—',
    email: '—',
  }
}

const SCROLLBAR_CSS = `
  .pipeline-board::-webkit-scrollbar { height: 6px; }
  .pipeline-board::-webkit-scrollbar-track { background: var(--bg-card); border-radius: 3px; }
  .pipeline-board::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .pipeline-board { scrollbar-width: thin; scrollbar-color: var(--border) var(--bg-card); }
  .col-body::-webkit-scrollbar { width: 4px; }
  .col-body::-webkit-scrollbar-track { background: transparent; }
  .col-body::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
  .col-wrap:hover .col-body::-webkit-scrollbar-thumb { background: var(--border); }
  .col-body { scrollbar-width: thin; scrollbar-color: transparent transparent; }
  .col-wrap:hover .col-body { scrollbar-color: var(--border) transparent; }
  @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`

const chips: { key: FilterChip; label: string; activeColor: string; activeBg: string; activeBorder: string }[] = [
  { key: 'mine', label: 'Meus leads', activeColor: '#f97316', activeBg: 'rgba(249,115,22,0.15)', activeBorder: '#f97316' },
  { key: 'hot', label: '🔥 Quentes', activeColor: '#f97316', activeBg: 'rgba(249,115,22,0.15)', activeBorder: '#f97316' },
  { key: 'cold', label: '❄️ Frios', activeColor: '#3b82f6', activeBg: 'rgba(59,130,246,0.15)', activeBorder: '#3b82f6' },
  { key: 'overdue', label: '⏰ Atrasados', activeColor: '#ef4444', activeBg: 'rgba(239,68,68,0.15)', activeBorder: '#ef4444' },
  { key: 'stale', label: '😴 Parados +15d', activeColor: '#f59e0b', activeBg: 'rgba(245,158,11,0.15)', activeBorder: '#f59e0b' },
]

// ── Component ──

export default function PipelinePage() {
  const nav = useNavigate()
  const [pipelines, setPipelines] = useState<PipelineItem[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [stages, setStages] = useState<StageConfig[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeChips, setActiveChips] = useState<Set<FilterChip>>(new Set())
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStage, setModalStage] = useState<string | undefined>(undefined)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')
  const reload = useCallback(() => setReloadKey(k => k + 1), [])
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Load pipelines on mount + reload
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const pipelinesData = await getPipelines()
        setPipelines(pipelinesData.map((p: PipelineItem) => ({ id: p.id, name: p.name })))

        if (pipelinesData.length > 0) {
          const pid = selectedPipelineId ?? pipelinesData[0].id
          setSelectedPipelineId(pid)
          const kanban: KanbanData = await getKanban(pid)
          setStages(kanban.stages.map((s: KanbanStage) => ({ id: s.id, name: s.name, color: s.color, position: s.position })))
          const allLeads: Lead[] = []
          kanban.stages.forEach((s: KanbanStage) => {
            s.leads.forEach((l: ApiLead) => allLeads.push(mapApiLeadToLead(l, s.name)))
          })
          setLeads(allLeads)
        }
      } catch {
        setError('Erro ao carregar pipelines')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Switch pipeline
  async function handlePipelineChange(pipelineId: string) {
    try {
      setLoading(true)
      setSelectedPipelineId(pipelineId)
      const kanban: KanbanData = await getKanban(pipelineId)
      setStages(kanban.stages.map((s: KanbanStage) => ({ id: s.id, name: s.name, color: s.color, position: s.position })))
      const allLeads: Lead[] = []
      kanban.stages.forEach((s: KanbanStage) => {
        s.leads.forEach((l: ApiLead) => allLeads.push(mapApiLeadToLead(l, s.name)))
      })
      setLeads(allLeads)
    } catch {
      setError('Erro ao carregar pipeline')
    } finally {
      setLoading(false)
    }
  }

  function toggleChip(chip: FilterChip) {
    setActiveChips((prev) => {
      const next = new Set(prev)
      if (next.has(chip)) next.delete(chip); else next.add(chip)
      return next
    })
  }

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const q = search.toLowerCase()
      if (q && !lead.name.toLowerCase().includes(q) && !lead.company.toLowerCase().includes(q)) return false
      if (activeChips.has('hot') && lead.temperature !== 'HOT') return false
      if (activeChips.has('cold') && lead.temperature !== 'COLD') return false
      if (activeChips.has('stale')) {
        const m = lead.lastContact?.match(/(\d+) dia/)
        if (!m || parseInt(m[1] ?? '0') < 15) return false
      }
      return true
    })
  }, [leads, search, activeChips])

  const stats = useMemo(() => {
    const total = filtered.length
    const totalValue = filtered.reduce((s, l) => s + l.value, 0)
    const hot = filtered.filter((l) => l.temperature === 'HOT').length
    const stale = filtered.filter((l) => {
      const m = l.lastContact?.match(/(\d+) dia/)
      return m && parseInt(m[1] ?? '0') >= 5
    }).length
    return { total, totalValue, hot, stale }
  }, [filtered])

  function leadsForStage(stageName: string): Lead[] {
    return filtered.filter((l) => l.stage === stageName)
  }
  function stageValue(stageName: string): number {
    return leadsForStage(stageName).reduce((s, l) => s + l.value, 0)
  }

  // ── Drag handlers ──
  const onDragStart = useCallback((e: DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const onDragOver = useCallback((e: DragEvent, stageName: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(stageName)
  }, [])

  const onDragLeave = useCallback(() => { setDropTarget(null) }, [])

  const onDrop = useCallback((e: DragEvent, stageName: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    const stageObj = stages.find(s => s.name === stageName)
    if (!stageObj) return

    // Find previous stage for rollback
    const prevLead = leads.find(l => l.id === leadId)
    const prevStage = prevLead?.stage

    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: stageName } : l))
    setDraggedId(null)
    setDropTarget(null)

    // Persist to backend
    api.patch(`/leads/${leadId}`, { stageId: stageObj.id })
      .then(() => showToast(`Lead movido para ${stageName}`))
      .catch(() => {
        if (prevStage) setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: prevStage } : l))
        showToast('Erro ao mover lead')
      })
  }, [stages, leads])

  const onDragEnd = useCallback(() => { setDraggedId(null); setDropTarget(null) }, [])

  async function handleNewLead(data: NewLeadData) {
    const tempMap: Record<string, Lead['temperature']> = { Quente: 'HOT', Morno: 'WARM', Frio: 'COLD' }
    const stageObj = stages.find(s => s.name === data.stage)
    if (!stageObj || !selectedPipelineId) return

    try {
      const { data: res } = await api.post('/leads', {
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        expectedValue: parseInt(data.value) || null,
        stageId: stageObj.id,
        pipelineId: selectedPipelineId,
        temperature: tempMap[data.temperature] ?? 'WARM',
      })
      if (res.success) {
        setLeads((prev) => [mapApiLeadToLead(res.data, data.stage), ...prev])
        showToast('Lead criado com sucesso!')
      }
    } catch {
      showToast('Erro ao criar lead')
    }
  }

  // ── Loading / Error states ──
  if (loading) {
    return (
      <AppLayout menuItems={gestaoMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando pipeline...</span>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout menuItems={gestaoMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 14, color: '#ef4444' }}>{error}</span>
          <button onClick={() => window.location.reload()} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      </AppLayout>
    )
  }

  if (pipelines.length === 0) {
    return (
      <AppLayout menuItems={gestaoMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 600 }}>Nenhum pipeline encontrado</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Crie seu primeiro pipeline para começar a gerenciar seus leads.</span>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <style>{SCROLLBAR_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 108px)' }}>

      {/* Header + Stats inline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Pipeline</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #f97316', background: 'rgba(249,115,22,0.12)', color: '#f97316', display: 'flex', alignItems: 'center', gap: 4 }}>
              <KanbanIcon size={14} strokeWidth={1.5} /> Kanban
            </button>
            <button onClick={() => nav('/gestao/leads')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <List size={14} strokeWidth={1.5} /> Lista
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
          <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>Valor</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{formatCurrency(stats.totalValue)}</span>
          <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>Quentes</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>🔥 {stats.hot}</span>
          <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>Sem interação +5d</span><span style={{ color: '#ef4444', fontWeight: 700, marginLeft: 4 }}>{stats.stale}</span>
        </div>
        <button onClick={() => { setModalStage(undefined); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}>
          <Plus size={15} strokeWidth={2} /> Novo Lead
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {chips.map((c) => {
            const on = activeChips.has(c.key)
            return (
              <button key={c.key} onClick={() => toggleChip(c.key)} style={{
                borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                background: on ? c.activeBg : 'var(--bg-card)', border: `1px solid ${on ? c.activeBorder : 'var(--border)'}`, color: on ? c.activeColor : 'var(--text-secondary)',
              }}>{c.label}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead ou empresa..."
              style={{ width: 220, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px 6px 32px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select
            value={selectedPipelineId ?? ''}
            onChange={(e) => handlePipelineChange(e.target.value)}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 28px 6px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none' as const,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Board */}
      <div className="pipeline-board" style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 12, height: '100%', paddingBottom: 8 }}>
          {stages.map((stage) => {
            const stageLeads = leadsForStage(stage.name)
            const val = stageValue(stage.name)
            const isDropping = dropTarget === stage.name
            return (
              <div
                key={stage.id} className="col-wrap"
                onDragOver={(e) => onDragOver(e, stage.name)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, stage.name)}
                style={{
                  width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
                  background: 'var(--bg)', borderRadius: 12, maxHeight: '100%',
                  border: isDropping ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Header */}
                <div style={{ background: `${stage.color}26`, borderRadius: 8, padding: '10px 14px', margin: '8px 8px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: stage.color }}>{stage.name}</span>
                      <span style={{ background: `${stage.color}33`, color: stage.color, borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{stageLeads.length}</span>
                    </div>
                    <AddBtn onClick={() => { setModalStage(stage.name); setModalOpen(true) }} />
                  </div>
                  {val > 0 && <div style={{ fontSize: 12, color: stage.color, opacity: 0.7, marginTop: 2, fontWeight: 700 }}>{formatCurrency(val)}</div>}
                </div>
                {/* Body */}
                <div className="col-body" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px', minHeight: 0 }}>
                  {stageLeads.length === 0 ? (
                    <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Sem leads aqui</div>
                  ) : stageLeads.map((lead) => {
                    const temp = tempConfig[lead.temperature]
                    const isDragged = draggedId === lead.id
                    const isHov = hoveredCard === lead.id
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, lead.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => setSelectedLead(lead)}
                        onMouseEnter={() => setHoveredCard(lead.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          background: isHov ? 'var(--bg-elevated)' : 'var(--bg-card)',
                          border: `1px solid ${isHov ? 'var(--border)' : 'var(--border)'}`,
                          borderRadius: 10, padding: 14, marginBottom: 8,
                          cursor: 'grab', transition: 'all 0.2s',
                          opacity: isDragged ? 0.5 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.name}</span>
                          <span style={{ background: temp.bg, color: temp.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{temp.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lead.company}</div>
                        {lead.value > 0 && <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, marginTop: 6 }}>{formatCurrency(lead.value)}</div>}
                        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{lead.responsible}</div>
                            {lead.lastContact && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.lastContact}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <ActionBtn color="#25d166"><MessageCircle size={14} strokeWidth={1.5} /></ActionBtn>
                            <ActionBtn color="#3b82f6"><Mail size={14} strokeWidth={1.5} /></ActionBtn>
                            <ActionBtn color="#f97316"><Phone size={14} strokeWidth={1.5} /></ActionBtn>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      </div>{/* end outer flex container */}

      {/* Drawer */}
      {selectedLead && <LeadDrawer lead={selectedLead} onClose={() => { setSelectedLead(null); reload() }} stageColor={stages.find((s) => s.name === selectedLead.stage)?.color ?? 'var(--text-muted)'} instance="gestao" />}
      <NewLeadModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleNewLead} defaultStage={modalStage} />
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `4px solid ${toast.startsWith('Erro') ? '#ef4444' : '#22c55e'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}
    </AppLayout>
  )
}

// ── Small sub-components ──

function AddBtn({ onClick }: { onClick?: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)',
        background: h ? 'var(--border)' : 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', transition: 'background 0.15s',
      }}
    >
      <Plus size={14} strokeWidth={1.5} />
    </button>
  )
}

function ActionBtn({ children, color }: { children: React.ReactNode; color: string }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={(e) => e.stopPropagation()}
      style={{ background: h ? 'var(--border)' : 'transparent', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background 0.15s' }}>
      {children}
    </button>
  )
}
