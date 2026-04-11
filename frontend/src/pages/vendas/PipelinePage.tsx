import { useState, useEffect, useCallback, useRef, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MessageCircle, Mail, Phone, Plus, Loader2 } from 'lucide-react'
import api from '../../services/api'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import LeadDrawer from '../../components/shared/LeadDrawer/LeadDrawer'
import NewLeadModal, { type NewLeadData } from '../../components/shared/NewLeadModal/NewLeadModal'
import { SendEmailModal, ConnectGmailModal } from '../../components/shared/EmailModal/EmailModal'
import { getPipelines, getKanban } from '../../services/pipeline.service'

// ── Types ──

type Temperature = 'HOT' | 'WARM' | 'COLD'

type LeadStatus = 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'

interface Lead {
  id: string; name: string; company: string; value: number; stage: string
  temperature: Temperature; lastContact: string | null; phone: string; email: string
  status: LeadStatus
  wonAt: string | null
}

interface StageConfig { id: string; name: string; color: string; type: string }

interface ApiLead {
  id: string; name: string; company: string | null; phone: string | null; whatsapp: string | null; email: string | null
  expectedValue: string | number | null; closedValue: string | number | null; temperature: Temperature; stageId: string; lastActivityAt: string | null
  responsible: { id: string; name: string }; status?: LeadStatus; wonAt?: string | null
}

interface KanbanStage {
  id: string; name: string; color: string; type?: string; position: number; leads: ApiLead[]
}

// ── Helpers ──

const tempConfig: Record<Temperature, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

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

function mapApiLead(l: ApiLead, stageName: string): Lead {
  return {
    id: l.id, name: l.name, company: l.company ?? '', value: Number(l.closedValue) || Number(l.expectedValue) || 0,
    stage: stageName, temperature: l.temperature, lastContact: formatTimeAgo(l.lastActivityAt),
    phone: l.phone ?? l.whatsapp ?? '—', email: l.email ?? '—', status: l.status ?? 'ACTIVE',
    wonAt: l.wonAt ?? null,
  }
}

// Short DD/MM/AA formatter used by the WON card marker.
function formatWonAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const CSS = `
  .vp-board::-webkit-scrollbar{height:6px}.vp-board::-webkit-scrollbar-track{background:var(--bg-card);border-radius:3px}.vp-board::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}.vp-board{scrollbar-width:thin;scrollbar-color:var(--border) var(--bg-card)}
  .vp-col::-webkit-scrollbar{width:4px}.vp-col::-webkit-scrollbar-track{background:transparent}.vp-col::-webkit-scrollbar-thumb{background:transparent;border-radius:4px}.vp-wrap:hover .vp-col::-webkit-scrollbar-thumb{background:var(--border)}.vp-col{scrollbar-width:thin;scrollbar-color:transparent transparent}.vp-wrap:hover .vp-col{scrollbar-color:var(--border) transparent}
`

// ── Component ──

export default function VendasPipelinePage() {
  const [stages, setStages] = useState<StageConfig[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [pipelineId, setPipelineId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStage, setModalStage] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState('')
  const boardRef = useRef<HTMLDivElement>(null)
  const [wonLostDrop, setWonLostDrop] = useState<{ leadId: string; stageName: string; stageId: string; type: 'WON' | 'LOST' } | null>(null)
  const [lossReasons, setLossReasons] = useState<{ id: string; name: string }[]>([])
  // Email composer state for the kanban card e-mail icon. Lifted to the
  // page level so the modal lives outside the individual card loop.
  const [emailLead, setEmailLead] = useState<Lead | null>(null)
  const [emailNeedsConnect, setEmailNeedsConnect] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/leads/loss-reasons').then(r => setLossReasons(r.data.data ?? [])).catch(() => {})
  }, [])
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

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
    async function load() {
      setLoading(true)
      try {
        const pipelinesData = await getPipelines()
        if (pipelinesData.length > 0) {
          const pid = pipelineId || pipelinesData[0].id
          setPipelineId(pid)
          const kanban = await getKanban(pid)
          setStages(kanban.stages.map((s: KanbanStage) => ({ id: s.id, name: s.name, color: s.color, type: s.type ?? 'NORMAL' })))
          const allLeads: Lead[] = []
          kanban.stages.forEach((s: KanbanStage) => {
            s.leads.forEach((l: ApiLead) => allLeads.push(mapApiLead(l, s.name)))
          })
          setLeads(allLeads)
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = leads.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q)
  })

  const stats = {
    total: filtered.length,
    totalValue: filtered.reduce((s, l) => s + l.value, 0),
    hot: filtered.filter(l => l.temperature === 'HOT').length,
  }

  const onDragStart = useCallback((e: DragEvent, id: string) => { setDraggedId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) }, [])
  const onDragOver = useCallback((e: DragEvent, s: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(s)
    const board = boardRef.current
    if (board) {
      const edge = 100
      if (e.clientX < edge) board.scrollLeft -= 12
      else if (e.clientX > window.innerWidth - edge) board.scrollLeft += 12
    }
  }, [])
  const onDragLeave = useCallback(() => setDropTarget(null), [])
  const onDrop = useCallback((e: DragEvent, targetStageName: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    const stageObj = stages.find(s => s.name === targetStageName)
    if (!stageObj) return
    setDraggedId(null)
    setDropTarget(null)

    // Intercept WON/LOST stages
    if (stageObj.type === 'WON' || stageObj.type === 'LOST') {
      setWonLostDrop({ leadId, stageName: targetStageName, stageId: stageObj.id, type: stageObj.type })
      return
    }

    // Find the lead's current stage for rollback
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
    setLeads(p => p.map(l => l.id === leadId ? { ...l, stage: targetStageName, status: 'ACTIVE' } : l))

    // Persist to backend
    api.patch(`/leads/${leadId}`, payload)
      .then(() => showToast(`Lead movido para ${targetStageName}`))
      .catch((err) => {
        console.error('[Pipeline] onDrop PATCH failed:', err?.response?.data ?? err)
        if (prevStage) setLeads(p => p.map(l => l.id === leadId ? { ...l, stage: prevStage, status: prevStatus } : l))
        showToast('Erro ao mover lead')
      })
  }, [stages, leads])
  const onDragEnd = useCallback(() => { setDraggedId(null); setDropTarget(null) }, [])

  async function handleNewLead(data: NewLeadData) {
    const tempMap: Record<string, Lead['temperature']> = { Quente: 'HOT', Morno: 'WARM', Frio: 'COLD' }
    const stageObj = stages.find(s => s.name === data.stage)
    if (!stageObj || !pipelineId) return

    try {
      const { data: res } = await api.post('/leads', {
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        expectedValue: parseInt(data.value) || null,
        stageId: stageObj.id,
        pipelineId,
        temperature: tempMap[data.temperature] ?? 'WARM',
      })
      if (res.success) {
        const created = res.data
        setLeads(prev => [mapApiLead(created, data.stage), ...prev])
        showToast('Lead criado!')
      }
    } catch (err) {
      console.error('[Pipeline] Error creating lead:', err)
      showToast('Erro ao criar lead')
    }
  }

  if (loading) {
    return (
      <AppLayout menuItems={vendasMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
          <Loader2 size={24} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando pipeline...</span>
        </div>
      </AppLayout>
    )
  }

  if (stages.length === 0) {
    return (
      <AppLayout menuItems={vendasMenuItems}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', color: 'var(--text-muted)', fontSize: 14 }}>Nenhum pipeline disponível</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout menuItems={vendasMenuItems}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 108px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Meu Pipeline</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Meus leads</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
          <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>Valor</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{formatCurrency(stats.totalValue)}</span>
          <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>Quentes</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>🔥 {stats.hot}</span>
        </div>
        <button onClick={() => { setModalStage(undefined); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}>
          <Plus size={15} strokeWidth={2} /> Novo Lead
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, position: 'relative', maxWidth: 240, flexShrink: 0 }}>
        <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead..."
          style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px 6px 32px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Board */}
      <div ref={boardRef} className="vp-board" style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 12, height: '100%', paddingBottom: 8 }}>
          {stages.map((stage) => {
            const sl = filtered.filter(l => l.stage === stage.name)
            const sv = sl.reduce((s, l) => s + l.value, 0)
            return (
              <div key={stage.id} className="vp-wrap"
                onDragOver={(e) => onDragOver(e, stage.name)} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, stage.name)}
                style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRadius: 12, maxHeight: '100%', border: dropTarget === stage.name ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent', transition: 'border-color 0.2s' }}>
                <div style={{ background: `${stage.color}26`, borderRadius: 8, padding: '10px 14px', margin: '8px 8px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: stage.color }}>{stage.name}</span>
                      <span style={{ background: `${stage.color}33`, color: stage.color, borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{sl.length}</span>
                    </div>
                    <AddBtn onClick={() => { setModalStage(stage.name); setModalOpen(true) }} />
                  </div>
                  {sv > 0 && <div style={{ fontSize: 12, color: stage.color, opacity: 0.7, marginTop: 2, fontWeight: 700 }}>{formatCurrency(sv)}</div>}
                </div>
                <div className="vp-col" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px', minHeight: 0 }}>
                  {sl.length === 0 ? (
                    <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Sem leads</div>
                  ) : sl.map(lead => {
                    const temp = tempConfig[lead.temperature]
                    const isWon = lead.status === 'WON'
                    const wonAtLabel = isWon ? formatWonAt(lead.wonAt) : ''
                    return (
                      <div key={lead.id} draggable onDragStart={(e) => onDragStart(e, lead.id)} onDragEnd={onDragEnd} onClick={() => setSelectedLead(lead)}
                        onMouseEnter={() => setHoveredCard(lead.id)} onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          background: hoveredCard === lead.id ? 'var(--bg-elevated)' : 'var(--bg-card)',
                          border: isWon ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                          borderLeft: isWon ? '3px solid #22c55e' : '1px solid var(--border)',
                          borderRadius: 10, padding: 14, marginBottom: 8, cursor: 'grab', transition: 'all 0.2s', opacity: draggedId === lead.id ? 0.5 : 1,
                        }}>
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
                          {lead.lastContact && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.lastContact}</span>}
                          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                            <ActBtn color="#25d166" onClick={() => { const p = lead.phone.replace(/\D/g, ''); if (p && p !== '') { window.open(`https://wa.me/${p}`, '_blank'); api.post(`/leads/${lead.id}/interactions`, { type: 'WHATSAPP', notes: 'Contato via WhatsApp' }).catch(() => {}) } }}><MessageCircle size={14} strokeWidth={1.5} /></ActBtn>
                            <ActBtn color="#3b82f6" onClick={() => { openEmailForLead(lead) }}><Mail size={14} strokeWidth={1.5} /></ActBtn>
                            <ActBtn color="#f97316" onClick={() => { const p = lead.phone.replace(/\D/g, ''); if (p && p !== '') { window.open(`tel:${p}`); api.post(`/leads/${lead.id}/interactions`, { type: 'CALL', notes: 'Ligação realizada' }).catch(() => {}) } }}><Phone size={14} strokeWidth={1.5} /></ActBtn>
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

      </div>

      {selectedLead && <LeadDrawer lead={{ ...selectedLead, responsible: 'EU' }} onClose={() => setSelectedLead(null)} stageColor={stages.find(s => s.name === selectedLead.stage)?.color ?? 'var(--text-muted)'} instance="vendas" onUpdate={(leadId, changes) => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...changes } : l))
        setSelectedLead(prev => prev && prev.id === leadId ? { ...prev, ...changes } : prev)
      }} />}
      <NewLeadModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleNewLead} defaultStage={modalStage} />
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
          onNavigate={() => { setEmailNeedsConnect(false); navigate('/vendas/configuracoes?tab=integracoes') }}
        />
      )}
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `4px solid ${toast.startsWith('Erro') ? '#ef4444' : '#22c55e'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}
    </AppLayout>
  )
}

function AddBtn({ onClick }: { onClick?: () => void }) {
  const [h, setH] = useState(false)
  return <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: h ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'background 0.15s' }}><Plus size={14} strokeWidth={1.5} /></button>
}
function ActBtn({ children, color, onClick }: { children: React.ReactNode; color: string; onClick?: () => void }) {
  const [h, setH] = useState(false)
  return <button type="button" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={(e) => { e.stopPropagation(); onClick?.() }} style={{ background: h ? 'var(--border)' : 'transparent', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background 0.15s' }}>{children}</button>
}

function parseMoneyInput(raw: string): number {
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
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

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

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isWon ? 'Registrar Venda' : 'Marcar como Perdido'}</h2>
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
