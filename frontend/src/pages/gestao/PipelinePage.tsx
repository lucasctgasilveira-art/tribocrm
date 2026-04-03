import { useState, useMemo, useCallback, type DragEvent } from 'react'
import { Search, MessageCircle, Mail, Phone, Plus } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import LeadDrawer from '../../components/shared/LeadDrawer/LeadDrawer'

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

interface StageConfig { name: string; color: string }

// ── Config ──

const stages: StageConfig[] = [
  { name: 'Sem Contato', color: '#6b7280' },
  { name: 'Em Contato', color: '#3b82f6' },
  { name: 'Negociando', color: '#f59e0b' },
  { name: 'Proposta Enviada', color: '#a855f7' },
  { name: 'Venda Realizada', color: '#22c55e' },
  { name: 'Repescagem', color: '#f97316' },
  { name: 'Perdido', color: '#ef4444' },
]

const initialLeads: Lead[] = [
  { id:'1', name:'Camila Torres', company:'Torres & Filhos', value:12000, stage:'Sem Contato', temperature:'HOT', responsible:'AN', lastContact:'há 2 dias', phone:'(21) 98712-3344', email:'camila@torres.com' },
  { id:'2', name:'Rafael Mendes', company:'MendesNet', value:8500, stage:'Sem Contato', temperature:'COLD', responsible:'PG', lastContact:'há 8 dias', phone:'(11) 97654-3210', email:'rafael@mendesnet.com' },
  { id:'3', name:'Pedro Alves', company:'Alves Tech', value:5000, stage:'Sem Contato', temperature:'WARM', responsible:'LC', lastContact:'há 3 dias', phone:'(21) 96543-2109', email:'pedro@alves.com' },
  { id:'4', name:'Fernanda Lima', company:'Lima Distribuidora', value:18000, stage:'Em Contato', temperature:'HOT', responsible:'AN', lastContact:'hoje', phone:'(31) 95432-1098', email:'fernanda@lima.com' },
  { id:'5', name:'Marcos Oliveira', company:'MO Serviços', value:5000, stage:'Em Contato', temperature:'COLD', responsible:'PG', lastContact:'há 18 dias', phone:'(41) 94321-0987', email:'marcos@mo.com' },
  { id:'6', name:'Juliana Costa', company:'Costa Digital', value:9500, stage:'Em Contato', temperature:'WARM', responsible:'MR', lastContact:'há 4 dias', phone:'(51) 93210-9876', email:'juliana@costa.com' },
  { id:'7', name:'Roberto Souza', company:'RS Comércio', value:32000, stage:'Negociando', temperature:'HOT', responsible:'AN', lastContact:'há 1 dia', phone:'(21) 92109-8765', email:'roberto@rs.com' },
  { id:'8', name:'Ana Paula Costa', company:'Costa & Filhos', value:12000, stage:'Negociando', temperature:'WARM', responsible:'LC', lastContact:'há 5 dias', phone:'(11) 91098-7654', email:'ana@costa.com' },
  { id:'9', name:'Thiago Bastos', company:'Bastos & Co', value:7500, stage:'Negociando', temperature:'COLD', responsible:'TB', lastContact:'há 7 dias', phone:'(21) 90987-6543', email:'thiago@bastos.com' },
  { id:'10', name:'Priscila Gomes', company:'GomesTech', value:28000, stage:'Proposta Enviada', temperature:'HOT', responsible:'PG', lastContact:'há 2 dias', phone:'(11) 89876-5432', email:'priscila@gomestech.com' },
  { id:'11', name:'Diego Marques', company:'Marquesali', value:15000, stage:'Proposta Enviada', temperature:'WARM', responsible:'AN', lastContact:'há 3 dias', phone:'(31) 88765-4321', email:'diego@marquesali.com' },
  { id:'12', name:'Juliana Torres', company:'Torres Import', value:28000, stage:'Venda Realizada', temperature:'HOT', responsible:'LC', lastContact:'hoje', phone:'(21) 87654-3210', email:'juliana@torres.com' },
  { id:'13', name:'Bruno Salave', company:'SalaGroup', value:19000, stage:'Repescagem', temperature:'WARM', responsible:'MR', lastContact:'há 12 dias', phone:'(41) 86543-2109', email:'bruno@sala.com' },
  { id:'14', name:'Carla Mendes', company:'Mendes Soluções', value:6000, stage:'Perdido', temperature:'COLD', responsible:'TB', lastContact:'há 20 dias', phone:'(51) 85432-1098', email:'carla@mendes.com' },
  { id:'15', name:'Lucas Ferreira', company:'Ferreira & Cia', value:22000, stage:'Em Contato', temperature:'HOT', responsible:'PG', lastContact:'há 1 dia', phone:'(21) 84321-0987', email:'lucas@ferreira.com' },
]

const tempConfig: Record<Temperature, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

type FilterChip = 'mine' | 'hot' | 'cold' | 'overdue' | 'stale'

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

const SCROLLBAR_CSS = `
  .pipeline-board::-webkit-scrollbar { height: 6px; }
  .pipeline-board::-webkit-scrollbar-track { background: #161a22; border-radius: 3px; }
  .pipeline-board::-webkit-scrollbar-thumb { background: #22283a; border-radius: 3px; }
  .pipeline-board { scrollbar-width: thin; scrollbar-color: #22283a #161a22; }
  .col-body::-webkit-scrollbar { width: 4px; }
  .col-body::-webkit-scrollbar-track { background: transparent; }
  .col-body::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
  .col-wrap:hover .col-body::-webkit-scrollbar-thumb { background: #22283a; }
  .col-body { scrollbar-width: thin; scrollbar-color: transparent transparent; }
  .col-wrap:hover .col-body { scrollbar-color: #22283a transparent; }
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
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [activeChips, setActiveChips] = useState<Set<FilterChip>>(new Set())
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

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
    const id = e.dataTransfer.getData('text/plain')
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, stage: stageName } : l))
    setDraggedId(null)
    setDropTarget(null)
  }, [])

  const onDragEnd = useCallback(() => { setDraggedId(null); setDropTarget(null) }, [])

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <style>{SCROLLBAR_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 108px)' }}>

      {/* Header + Stats inline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Pipeline</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13 }}>
          <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
          <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
          <span style={{ color: '#6b7280' }}>Valor</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{formatCurrency(stats.totalValue)}</span>
          <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
          <span style={{ color: '#6b7280' }}>Quentes</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>🔥 {stats.hot}</span>
          <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
          <span style={{ color: '#6b7280' }}>Sem interação +5d</span><span style={{ color: '#ef4444', fontWeight: 700, marginLeft: 4 }}>{stats.stale}</span>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
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
                background: on ? c.activeBg : '#161a22', border: `1px solid ${on ? c.activeBorder : '#22283a'}`, color: on ? c.activeColor : '#9ca3af',
              }}>{c.label}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#6b7280" strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead ou empresa..."
              style={{ width: 220, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '6px 12px 6px 32px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '6px 28px 6px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', cursor: 'pointer', appearance: 'none' as const,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            <option>Pipeline Principal</option>
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
                key={stage.name} className="col-wrap"
                onDragOver={(e) => onDragOver(e, stage.name)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, stage.name)}
                style={{
                  width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
                  background: '#0f1117', borderRadius: 12, maxHeight: '100%',
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
                    <AddBtn />
                  </div>
                  {val > 0 && <div style={{ fontSize: 12, color: stage.color, opacity: 0.7, marginTop: 2, fontWeight: 700 }}>{formatCurrency(val)}</div>}
                </div>
                {/* Body */}
                <div className="col-body" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px', minHeight: 0 }}>
                  {stageLeads.length === 0 ? (
                    <div style={{ border: '1px dashed #22283a', borderRadius: 8, padding: 20, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>Sem leads aqui</div>
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
                          background: isHov ? '#1c2130' : '#161a22',
                          border: `1px solid ${isHov ? '#374151' : '#22283a'}`,
                          borderRadius: 10, padding: 14, marginBottom: 8,
                          cursor: 'grab', transition: 'all 0.2s',
                          opacity: isDragged ? 0.5 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.name}</span>
                          <span style={{ background: temp.bg, color: temp.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{temp.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{lead.company}</div>
                        {lead.value > 0 && <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, marginTop: 6 }}>{formatCurrency(lead.value)}</div>}
                        <div style={{ marginTop: 10, borderTop: '1px solid #22283a', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{lead.responsible}</div>
                            {lead.lastContact && <span style={{ fontSize: 11, color: '#6b7280' }}>{lead.lastContact}</span>}
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
      {selectedLead && <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} stageColor={stages.find((s) => s.name === selectedLead.stage)?.color ?? '#6b7280'} instance="gestao" />}
    </AppLayout>
  )
}

// ── Small sub-components ──

function AddBtn() {
  const [h, setH] = useState(false)
  return (
    <button
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 24, height: 24, borderRadius: 6, border: '1px solid #22283a',
        background: h ? '#22283a' : 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#6b7280', transition: 'background 0.15s',
      }}
    >
      <Plus size={14} strokeWidth={1.5} />
    </button>
  )
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? '#e8eaf0' }}>{value}</span>
    </div>
  )
}

function StatSep() { return <div style={{ width: 1, height: 20, background: '#22283a' }} /> }

function ActionBtn({ children, color }: { children: React.ReactNode; color: string }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={(e) => e.stopPropagation()}
      style={{ background: h ? '#22283a' : 'transparent', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background 0.15s' }}>
      {children}
    </button>
  )
}
