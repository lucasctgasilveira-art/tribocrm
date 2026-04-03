import { useState, useMemo, useCallback, type DragEvent } from 'react'
import { Search, MessageCircle, Mail, Phone, Plus } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'
import LeadDrawer from '../../components/shared/LeadDrawer/LeadDrawer'
import NewLeadModal, { type NewLeadData } from '../../components/shared/NewLeadModal/NewLeadModal'

// ── Types ──

type Temperature = 'HOT' | 'WARM' | 'COLD'

interface Lead {
  id: string; name: string; company: string; value: number; stage: string
  temperature: Temperature; responsible: string; lastContact: string | null
  phone: string; email: string
}

interface StageConfig { name: string; color: string }

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
  { id:'1', name:'Camila Torres', company:'Torres & Filhos', value:12000, stage:'Sem Contato', temperature:'HOT', responsible:'EU', lastContact:'há 2 dias', phone:'(21) 98712-3344', email:'camila@torres.com' },
  { id:'2', name:'Rafael Mendes', company:'MendesNet', value:8500, stage:'Sem Contato', temperature:'COLD', responsible:'EU', lastContact:'há 8 dias', phone:'(11) 97654-3210', email:'rafael@mendesnet.com' },
  { id:'3', name:'Fernanda Lima', company:'Lima Distribuidora', value:18000, stage:'Em Contato', temperature:'HOT', responsible:'EU', lastContact:'hoje', phone:'(31) 95432-1098', email:'fernanda@lima.com' },
  { id:'4', name:'Marcos Oliveira', company:'MO Serviços', value:5000, stage:'Em Contato', temperature:'COLD', responsible:'EU', lastContact:'há 18 dias', phone:'(41) 94321-0987', email:'marcos@mo.com' },
  { id:'5', name:'Roberto Souza', company:'RS Comércio', value:32000, stage:'Negociando', temperature:'HOT', responsible:'EU', lastContact:'há 1 dia', phone:'(21) 92109-8765', email:'roberto@rs.com' },
  { id:'6', name:'Ana Paula Costa', company:'Costa & Filhos', value:12000, stage:'Negociando', temperature:'WARM', responsible:'EU', lastContact:'há 5 dias', phone:'(11) 91098-7654', email:'ana@costa.com' },
  { id:'7', name:'Priscila Gomes', company:'GomesTech', value:28000, stage:'Proposta Enviada', temperature:'HOT', responsible:'EU', lastContact:'há 2 dias', phone:'(11) 89876-5432', email:'priscila@gomestech.com' },
  { id:'8', name:'Diego Marques', company:'Marquesali', value:15000, stage:'Proposta Enviada', temperature:'WARM', responsible:'EU', lastContact:'há 3 dias', phone:'(31) 88765-4321', email:'diego@marquesali.com' },
  { id:'9', name:'Juliana Torres', company:'Torres Import', value:28000, stage:'Venda Realizada', temperature:'HOT', responsible:'EU', lastContact:'hoje', phone:'(21) 87654-3210', email:'juliana@torres.com' },
  { id:'10', name:'Bruno Salave', company:'SalaGroup', value:19000, stage:'Repescagem', temperature:'WARM', responsible:'EU', lastContact:'há 12 dias', phone:'(41) 86543-2109', email:'bruno@sala.com' },
]

const tempConfig: Record<Temperature, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

const CSS = `
  .vp-board::-webkit-scrollbar{height:6px}.vp-board::-webkit-scrollbar-track{background:#161a22;border-radius:3px}.vp-board::-webkit-scrollbar-thumb{background:#22283a;border-radius:3px}.vp-board{scrollbar-width:thin;scrollbar-color:#22283a #161a22}
  .vp-col::-webkit-scrollbar{width:4px}.vp-col::-webkit-scrollbar-track{background:transparent}.vp-col::-webkit-scrollbar-thumb{background:transparent;border-radius:4px}.vp-wrap:hover .vp-col::-webkit-scrollbar-thumb{background:#22283a}.vp-col{scrollbar-width:thin;scrollbar-color:transparent transparent}.vp-wrap:hover .vp-col{scrollbar-color:#22283a transparent}
  @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}
`

export default function VendasPipelinePage() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStage, setModalStage] = useState<string | undefined>(undefined)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter((l) => !q || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q))
  }, [leads, search])

  const stats = useMemo(() => ({
    total: filtered.length,
    totalValue: filtered.reduce((s, l) => s + l.value, 0),
    hot: filtered.filter((l) => l.temperature === 'HOT').length,
  }), [filtered])

  const onDragStart = useCallback((e: DragEvent, id: string) => { setDraggedId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) }, [])
  const onDragOver = useCallback((e: DragEvent, s: string) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(s) }, [])
  const onDragLeave = useCallback(() => setDropTarget(null), [])
  const onDrop = useCallback((e: DragEvent, s: string) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setLeads((p) => p.map((l) => l.id === id ? { ...l, stage: s } : l)); setDraggedId(null); setDropTarget(null) }, [])
  const onDragEnd = useCallback(() => { setDraggedId(null); setDropTarget(null) }, [])

  function handleNewLead(data: NewLeadData) {
    const tempMap: Record<string, Lead['temperature']> = { Quente: 'HOT', Morno: 'WARM', Frio: 'COLD' }
    const newLead: Lead = {
      id: String(Date.now()), name: data.name, company: data.company,
      value: parseInt(data.value) || 0, stage: data.stage,
      temperature: tempMap[data.temperature] ?? 'WARM',
      responsible: 'EU', lastContact: 'agora', phone: data.phone || '—', email: data.email || '—',
    }
    setLeads((prev) => [newLead, ...prev])
  }

  return (
    <AppLayout menuItems={vendasMenuItems}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 108px)' }}>

      {/* Header + Stats inline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Meu Pipeline</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13 }}>
          <span style={{ color: '#6b7280' }}>Meus leads</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
          <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
          <span style={{ color: '#6b7280' }}>Valor</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{formatCurrency(stats.totalValue)}</span>
          <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
          <span style={{ color: '#6b7280' }}>Quentes</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>🔥 {stats.hot}</span>
        </div>
        <button onClick={() => { setModalStage(undefined); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}>
          <Plus size={15} strokeWidth={2} /> Novo Lead
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, position: 'relative', maxWidth: 240, flexShrink: 0 }}>
        <Search size={15} color="#6b7280" strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead..."
          style={{ width: '100%', background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '6px 12px 6px 32px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Board */}
      <div className="vp-board" style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 12, height: '100%', paddingBottom: 8 }}>
          {stages.map((stage) => {
            const sl = filtered.filter((l) => l.stage === stage.name)
            const sv = sl.reduce((s, l) => s + l.value, 0)
            return (
              <div key={stage.name} className="vp-wrap"
                onDragOver={(e) => onDragOver(e, stage.name)} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, stage.name)}
                style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#0f1117', borderRadius: 12, maxHeight: '100%', border: dropTarget === stage.name ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent', transition: 'border-color 0.2s' }}>
                {/* Header */}
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
                    <div style={{ border: '1px dashed #22283a', borderRadius: 8, padding: 20, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>Sem leads</div>
                  ) : sl.map((lead) => {
                    const temp = tempConfig[lead.temperature]
                    return (
                      <div key={lead.id} draggable onDragStart={(e) => onDragStart(e, lead.id)} onDragEnd={onDragEnd} onClick={() => setSelectedLead(lead)}
                        onMouseEnter={() => setHoveredCard(lead.id)} onMouseLeave={() => setHoveredCard(null)}
                        style={{ background: hoveredCard === lead.id ? '#1c2130' : '#161a22', border: `1px solid ${hoveredCard === lead.id ? '#374151' : '#22283a'}`, borderRadius: 10, padding: 14, marginBottom: 8, cursor: 'grab', transition: 'all 0.2s', opacity: draggedId === lead.id ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.name}</span>
                          <span style={{ background: temp.bg, color: temp.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{temp.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{lead.company}</div>
                        {lead.value > 0 && <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, marginTop: 6 }}>{formatCurrency(lead.value)}</div>}
                        <div style={{ marginTop: 10, borderTop: '1px solid #22283a', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {lead.lastContact && <span style={{ fontSize: 11, color: '#6b7280' }}>{lead.lastContact}</span>}
                          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                            <ActBtn color="#25d166"><MessageCircle size={14} strokeWidth={1.5} /></ActBtn>
                            <ActBtn color="#3b82f6"><Mail size={14} strokeWidth={1.5} /></ActBtn>
                            <ActBtn color="#f97316"><Phone size={14} strokeWidth={1.5} /></ActBtn>
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

      {selectedLead && <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} stageColor={stages.find((s) => s.name === selectedLead.stage)?.color ?? '#6b7280'} instance="vendas" />}
      <NewLeadModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleNewLead} defaultStage={modalStage} />
    </AppLayout>
  )
}

function AddBtn({ onClick }: { onClick?: () => void }) {
  const [h, setH] = useState(false)
  return <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #22283a', background: h ? '#22283a' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'background 0.15s' }}><Plus size={14} strokeWidth={1.5} /></button>
}
function ActBtn({ children, color }: { children: React.ReactNode; color: string }) {
  const [h, setH] = useState(false)
  return <button type="button" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={(e) => e.stopPropagation()} style={{ background: h ? '#22283a' : 'transparent', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background 0.15s' }}>{children}</button>
}
