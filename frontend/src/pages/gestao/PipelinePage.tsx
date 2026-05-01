import { useState, useEffect, useMemo, useCallback, useRef, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MessageCircle, Mail, Phone, Plus, Kanban as KanbanIcon, List, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import LeadDrawer from '../../components/shared/LeadDrawer/LeadDrawer'
import NewLeadModal, { type NewLeadData } from '../../components/shared/NewLeadModal/NewLeadModal'
import { SendEmailModal, ConnectGmailModal } from '../../components/shared/EmailModal/EmailModal'
import { getPipelines, getKanban } from '../../services/pipeline.service'
import api from '../../services/api'
import { notifyExtensionPhoneHint } from '../../utils/extensionBridge'

// ── Types ──

type Temperature = 'HOT' | 'WARM' | 'COLD'

type LeadStatus = 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'

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
  status: LeadStatus
  wonAt: string | null
  createdAt?: string
}

interface StageConfig { id: string; name: string; color: string; position: number; type: string }

interface ApiLead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  expectedValue: string | number | null
  closedValue: string | number | null
  temperature: Temperature
  stageId: string
  lastActivityAt: string | null
  responsible: { id: string; name: string }
  status?: LeadStatus
  wonAt?: string | null
  createdAt?: string
}

interface KanbanStage {
  id: string
  name: string
  color: string
  type?: string
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
  stages?: Array<{ id: string; name: string; sortOrder?: number; type?: string }>
  distributionType?: string
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
    value: Number(apiLead.closedValue) || Number(apiLead.expectedValue) || 0,
    stage: stageName,
    temperature: apiLead.temperature,
    responsible: getInitials(apiLead.responsible.name),
    lastContact: formatTimeAgo(apiLead.lastActivityAt),
    phone: apiLead.phone ?? apiLead.whatsapp ?? '—',
    email: apiLead.email ?? '—',
    status: apiLead.status ?? 'ACTIVE',
    wonAt: apiLead.wonAt ?? null,
    createdAt: apiLead.createdAt,
  }
}

// Short DD/MM/AA formatter used by the WON card marker.
function formatWonAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
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
  const boardRef = useRef<HTMLDivElement>(null)
  const [wonLostDrop, setWonLostDrop] = useState<{ leadId: string; stageName: string; stageId: string; type: 'WON' | 'LOST' } | null>(null)
  const [lossReasons, setLossReasons] = useState<{ id: string; name: string }[]>([])
  // Email composer state for the kanban card e-mail icon. Lifted to the
  // page level so the modal lives outside the individual card loop.
  const [emailLead, setEmailLead] = useState<Lead | null>(null)
  const [emailNeedsConnect, setEmailNeedsConnect] = useState(false)
  // Toggle surfaced by the "Mostrar arquivados" checkbox. Drives the
  // `includeArchived` query param on getKanban and re-fetches the
  // board whenever it flips, so archived leads (from the monthly
  // wonCardsArchiver cron) reappear in the Venda Realizada column.
  const [showArchived, setShowArchived] = useState(false)

  async function openEmailForLead(lead: Lead) {
    if (!lead.email || lead.email === '—') return
    try {
      const { data } = await api.get('/oauth/google/status')
      if (data?.data?.connected) setEmailLead(lead)
      else setEmailNeedsConnect(true)
    } catch {
      setEmailNeedsConnect(true)
    }
  }

  useEffect(() => {
    api.get('/leads/loss-reasons').then(r => setLossReasons(r.data.data ?? [])).catch(() => {})
  }, [])
  const [toast, setToast] = useState('')
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Load pipelines on mount + reload
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const pipelinesData = await getPipelines()
        setPipelines(pipelinesData.map((p: PipelineItem) => ({ id: p.id, name: p.name, stages: p.stages ?? [] })))

        if (pipelinesData.length > 0) {
          const pid = selectedPipelineId ?? pipelinesData[0].id
          setSelectedPipelineId(pid)
          const kanban: KanbanData = await getKanban(pid, { includeArchived: showArchived })
          setStages(kanban.stages.map((s: KanbanStage) => ({ id: s.id, name: s.name, color: s.color, position: s.position, type: s.type ?? 'NORMAL' })))
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
  }, [showArchived]) // eslint-disable-line react-hooks/exhaustive-deps

  // Switch pipeline
  async function handlePipelineChange(pipelineId: string) {
    try {
      setLoading(true)
      setSelectedPipelineId(pipelineId)
      const kanban: KanbanData = await getKanban(pipelineId, { includeArchived: showArchived })
      setStages(kanban.stages.map((s: KanbanStage) => ({ id: s.id, name: s.name, color: s.color, position: s.position, type: s.type ?? 'NORMAL' })))
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
    // Auto-scroll when dragging near edges
    const board = boardRef.current
    if (board) {
      const edge = 100
      if (e.clientX < edge) board.scrollLeft -= 12
      else if (e.clientX > window.innerWidth - edge) board.scrollLeft += 12
    }
  }, [])

  const onDragLeave = useCallback(() => { setDropTarget(null) }, [])

  const onDrop = useCallback((e: DragEvent, stageName: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    const stageObj = stages.find(s => s.name === stageName)
    if (!stageObj) return
    setDraggedId(null)
    setDropTarget(null)

    // Intercept WON/LOST stages — show confirmation modal
    if (stageObj.type === 'WON' || stageObj.type === 'LOST') {
      setWonLostDrop({ leadId, stageName, stageId: stageObj.id, type: stageObj.type })
      return
    }

    // Find previous stage for rollback
    const prevLead = leads.find(l => l.id === leadId)
    const prevStage = prevLead?.stage
    const prevStatus = prevLead?.status ?? 'ACTIVE'

    // Dropping into a NORMAL stage always means the lead is active.
    // We force status:'ACTIVE' unconditionally (idempotent for already-active
    // leads, authoritative for WON/LOST leads being reactivated) — without
    // this, a WON/LOST lead moved to a NORMAL column keeps status=WON/LOST
    // and disappears on reload because the kanban filters NORMAL stages by
    // status=ACTIVE.
    const payload: Record<string, unknown> = { stageId: stageObj.id, status: 'ACTIVE' }
    console.log('[Pipeline] onDrop → NORMAL, PATCH /leads/%s payload=%o prevStatus=%s', leadId, payload, prevStatus)

    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: stageName, status: 'ACTIVE' } : l))

    // Persist to backend
    api.patch(`/leads/${leadId}`, payload)
      .then(() => showToast(`Lead movido para ${stageName}`))
      .catch((err) => {
        console.error('[Pipeline] onDrop PATCH failed:', err?.response?.data ?? err)
        if (prevStage) setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: prevStage, status: prevStatus } : l))
        showToast('Erro ao mover lead')
      })
  }, [stages, leads])

  const onDragEnd = useCallback(() => { setDraggedId(null); setDropTarget(null) }, [])

  async function handleNewLead(data: NewLeadData) {
    const tempMap: Record<string, Lead['temperature']> = { Quente: 'HOT', Morno: 'WARM', Frio: 'COLD' }
    // Pipeline e etapa vem ja selecionados pelo usuario no modal
    // (data.pipelineId / data.stageId sao UUIDs reais).
    if (!data.pipelineId || !data.stageId) return

    try {
      const { data: res } = await api.post('/leads', {
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        expectedValue: parseInt(data.value) || null,
        stageId: data.stageId,
        pipelineId: data.pipelineId,
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
          <label
            title="Inclui cards arquivados pelo job mensal na coluna Venda Realizada"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
          >
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#f97316', cursor: 'pointer' }}
            />
            Mostrar arquivados
          </label>
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
      <div ref={boardRef} className="pipeline-board" style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>
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
                    const isWon = lead.status === 'WON'
                    const wonAtLabel = isWon ? formatWonAt(lead.wonAt) : ''
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
                          border: isWon ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                          borderLeft: isWon ? '3px solid #22c55e' : '1px solid var(--border)',
                          borderRadius: 10, padding: 14, marginBottom: 8,
                          cursor: 'grab', transition: 'all 0.2s',
                          opacity: isDragged ? 0.5 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.name}</span>
                          {isWon ? (
                            <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              ✓ Fechado{wonAtLabel ? ` · ${wonAtLabel}` : ''}
                            </span>
                          ) : (
                            <span style={{ background: temp.bg, color: temp.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{temp.label}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lead.company}</div>
                        {lead.value > 0 && <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, marginTop: 6 }}>{formatCurrency(lead.value)}</div>}
                        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{lead.responsible}</div>
                            {lead.lastContact && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.lastContact}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <ActionBtn color="#25d166" onClick={() => {
                              const p = lead.phone.replace(/\D/g, '')
                              if (!p) return
                              const full = p.length <= 11 ? '55' + p : p
                              void notifyExtensionPhoneHint({ phone: full, leadId: lead.id })
                              window.open(`https://wa.me/${full}`, '_blank')
                              api.post(`/leads/${lead.id}/interactions`, { type: 'WHATSAPP', notes: 'Contato iniciado pelo CRM' }).catch(() => {})
                            }}><MessageCircle size={14} strokeWidth={1.5} /></ActionBtn>
                            <ActionBtn color="#3b82f6" onClick={() => { openEmailForLead(lead) }}><Mail size={14} strokeWidth={1.5} /></ActionBtn>
                            <ActionBtn color="#f97316" onClick={() => {
                              const p = lead.phone.replace(/\D/g, '')
                              if (!p) return
                              window.open(`tel:${p}`)
                              api.post(`/leads/${lead.id}/interactions`, { type: 'CALL', notes: 'Contato iniciado pelo CRM' }).catch(() => {})
                            }}><Phone size={14} strokeWidth={1.5} /></ActionBtn>
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
      {selectedLead && <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} stageColor={stages.find((s) => s.name === selectedLead.stage)?.color ?? 'var(--text-muted)'} instance="gestao" onUpdate={(leadId, changes) => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...changes } : l))
        setSelectedLead(prev => prev && prev.id === leadId ? { ...prev, ...changes } : prev)
      }} />}
      <NewLeadModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleNewLead} defaultStage={modalStage} defaultPipelineId={selectedPipelineId ?? undefined} pipelines={pipelines.map(p => ({ id: p.id, name: p.name, stages: p.stages ?? [] }))} />
      {wonLostDrop && <WonLostConfirm drop={wonLostDrop} lossReasons={lossReasons} onClose={() => setWonLostDrop(null)} onDone={(leadId, stageId, stageName, type, patchPayload) => {
        const body = { stageId, ...patchPayload }
        console.log('[Pipeline] WonLost PATCH body:', JSON.stringify(body))
        api.patch(`/leads/${leadId}`, body)
          .then(() => {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: stageName, value: type === 'WON' ? Number(patchPayload.closedValue) : l.value } : l))
            if (type === 'WON') {
              const val = Number(patchPayload.closedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              showToast(`Venda registrada! Valor: ${val}`)
            } else { showToast('Lead marcado como perdido') }
          })
          .catch((err) => { console.error('[Pipeline] WonLost error:', err); showToast('Erro ao mover lead') })
          .finally(() => setWonLostDrop(null))
      }} />}
      {emailLead && (
        <SendEmailModal
          lead={{ id: emailLead.id, name: emailLead.name, company: emailLead.company, email: emailLead.email }}
          onClose={() => setEmailLead(null)}
          onSaved={() => { setEmailLead(null); showToast('E-mail enviado') }}
        />
      )}
      {emailNeedsConnect && (
        <ConnectGmailModal
          onClose={() => setEmailNeedsConnect(false)}
          onNavigate={() => { setEmailNeedsConnect(false); nav('/gestao/configuracoes?tab=integracoes') }}
        />
      )}
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

function ActionBtn({ children, color, onClick }: { children: React.ReactNode; color: string; onClick?: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      style={{ background: h ? 'var(--border)' : 'transparent', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background 0.15s' }}>
      {children}
    </button>
  )
}

// ── WON/LOST Confirmation Modal ──

function parseMoneyInput(raw: string): number {
  // Handle BR format: "15.000,50" → 15000.50, or "15000.50", or "15000"
  const cleaned = raw.replace(/\s/g, '')
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.'))
  return Number(cleaned)
}

function WonLostConfirm({ drop, lossReasons, onClose, onDone }: {
  drop: { leadId: string; stageId: string; stageName: string; type: 'WON' | 'LOST' }
  lossReasons: { id: string; name: string }[]
  onClose: () => void
  onDone: (leadId: string, stageId: string, stageName: string, type: string, payload: Record<string, unknown>) => void
}) {
  const [closedValue, setClosedValue] = useState('')
  const [wonAt, setWonAt] = useState(new Date().toISOString().slice(0, 10))
  const [lossReasonId, setLossReasonId] = useState('')
  const [saving, setSaving] = useState(false)

  const isWon = drop.type === 'WON'
  const parsedValue = parseMoneyInput(closedValue)
  const canSave = isWon ? (closedValue.trim() !== '' && !isNaN(parsedValue) && parsedValue > 0 && !!wonAt) : !!lossReasonId

  function handleConfirm() {
    if (!canSave || saving) return
    setSaving(true)
    if (isWon) {
      const payload = { status: 'WON', closedValue: parsedValue, wonAt: new Date(wonAt + 'T00:00:00.000Z').toISOString() }
      console.log('[WonLostConfirm] WON payload:', JSON.stringify(payload), 'leadId:', drop.leadId)
      onDone(drop.leadId, drop.stageId, drop.stageName, 'WON', payload)
    } else {
      const payload = { status: 'LOST', lossReasonId, lostAt: new Date().toISOString() }
      console.log('[WonLostConfirm] LOST payload:', JSON.stringify(payload), 'leadId:', drop.leadId)
      onDone(drop.leadId, drop.stageId, drop.stageName, 'LOST', payload)
    }
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isWon ? 'Registrar Venda' : 'Marcar como Perdido'}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Movendo para: {drop.stageName}</div>
        </div>
        <div style={{ padding: 24 }}>
          {isWon ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#22c55e', display: 'block', marginBottom: 6 }}>Valor fechado (R$) *</label>
                <input type="text" inputMode="decimal" autoFocus value={closedValue} onChange={e => setClosedValue(e.target.value)} placeholder="Ex: 15000 ou 15.000,00" style={{ ...inputS, borderColor: 'rgba(34,197,94,0.4)' }} />
                {closedValue && !isNaN(parsedValue) && parsedValue > 0 && (
                  <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>{parsedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#22c55e', display: 'block', marginBottom: 6 }}>Data de fechamento *</label>
                <input type="date" value={wonAt} onChange={e => setWonAt(e.target.value)} style={{ ...inputS, borderColor: 'rgba(34,197,94,0.4)' }} />
              </div>
            </>
          ) : (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#ef4444', display: 'block', marginBottom: 6 }}>Motivo de perda *</label>
              <select autoFocus value={lossReasonId} onChange={e => setLossReasonId(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer', borderColor: 'rgba(239,68,68,0.4)' }}>
                <option value="">Selecione o motivo...</option>
                {lossReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {lossReasons.length === 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>Nenhum motivo cadastrado.</div>}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!canSave || saving} style={{ background: canSave ? (isWon ? '#22c55e' : '#ef4444') : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Salvando...' : isWon ? 'Registrar Venda' : 'Confirmar Perda'}
          </button>
        </div>
      </div>
    </>
  )
}
