import { useState, useMemo } from 'react'
import { Search, MessageCircle, Mail, Phone, Plus } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

type Temperature = 'HOT' | 'WARM' | 'COLD'

interface MockLead {
  id: string
  name: string
  company: string
  value: number
  stage: string
  temperature: Temperature
  responsible: string
  lastContact: string | null
}

interface StageConfig {
  name: string
  color: string
}

const stages: StageConfig[] = [
  { name: 'Sem Contato', color: '#6b7280' },
  { name: 'Em Contato', color: '#3b82f6' },
  { name: 'Negociando', color: '#f59e0b' },
  { name: 'Proposta Enviada', color: '#a855f7' },
  { name: 'Venda Realizada', color: '#22c55e' },
  { name: 'Repescagem', color: '#f97316' },
  { name: 'Perdido', color: '#ef4444' },
]

const mockLeads: MockLead[] = [
  { id: '1', name: 'Carlos Mendes', company: 'Tech Solutions', value: 15000, stage: 'Sem Contato', temperature: 'HOT', responsible: 'AM', lastContact: 'há 2 dias' },
  { id: '2', name: 'Fernanda Lima', company: 'Grupo Lima', value: 8500, stage: 'Em Contato', temperature: 'WARM', responsible: 'PG', lastContact: 'hoje' },
  { id: '3', name: 'Roberto Souza', company: 'RS Comércio', value: 32000, stage: 'Negociando', temperature: 'HOT', responsible: 'AM', lastContact: 'há 1 dia' },
  { id: '4', name: 'Ana Paula Costa', company: 'Costa & Filhos', value: 12000, stage: 'Proposta Enviada', temperature: 'WARM', responsible: 'LS', lastContact: 'há 5 dias' },
  { id: '5', name: 'Marcos Oliveira', company: 'MO Serviços', value: 5000, stage: 'Em Contato', temperature: 'COLD', responsible: 'PG', lastContact: 'há 18 dias' },
  { id: '6', name: 'Juliana Torres', company: 'Torres Import', value: 28000, stage: 'Venda Realizada', temperature: 'HOT', responsible: 'LS', lastContact: 'hoje' },
]

const tempConfig: Record<Temperature, { label: string; color: string; bg: string }> = {
  HOT: { label: '🔥 Quente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  WARM: { label: '🌤 Morno', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  COLD: { label: '❄️ Frio', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

type FilterChip = 'mine' | 'hot' | 'cold' | 'overdue' | 'stale'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

// ── Styles injected once ──

const SCROLLBAR_CSS = `
  .pipeline-board::-webkit-scrollbar { height: 6px; }
  .pipeline-board::-webkit-scrollbar-track { background: #161a22; border-radius: 3px; }
  .pipeline-board::-webkit-scrollbar-thumb { background: #22283a; border-radius: 3px; }
  .pipeline-board::-webkit-scrollbar-thumb:hover { background: #374151; }
  .pipeline-board { scrollbar-width: thin; scrollbar-color: #22283a #161a22; }

  .col-body::-webkit-scrollbar { width: 4px; }
  .col-body::-webkit-scrollbar-track { background: transparent; }
  .col-body::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
  .col-wrap:hover .col-body::-webkit-scrollbar-thumb { background: #22283a; }
  .col-body { scrollbar-width: thin; scrollbar-color: transparent transparent; }
  .col-wrap:hover .col-body { scrollbar-color: #22283a transparent; }
`

// ── Component ──

export default function PipelinePage() {
  const [search, setSearch] = useState('')
  const [activeChips, setActiveChips] = useState<Set<FilterChip>>(new Set())
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  function toggleChip(chip: FilterChip) {
    setActiveChips((prev) => {
      const next = new Set(prev)
      if (next.has(chip)) next.delete(chip)
      else next.add(chip)
      return next
    })
  }

  const filtered = useMemo(() => {
    return mockLeads.filter((lead) => {
      const q = search.toLowerCase()
      if (q && !lead.name.toLowerCase().includes(q) && !lead.company.toLowerCase().includes(q)) return false
      if (activeChips.has('hot') && lead.temperature !== 'HOT') return false
      if (activeChips.has('cold') && lead.temperature !== 'COLD') return false
      if (activeChips.has('overdue') && !lead.lastContact?.includes('5 dia')) return false
      if (activeChips.has('stale') && !lead.lastContact?.includes('18 dia')) return false
      return true
    })
  }, [search, activeChips])

  const stats = useMemo(() => {
    const total = filtered.length
    const totalValue = filtered.reduce((s, l) => s + l.value, 0)
    const hot = filtered.filter((l) => l.temperature === 'HOT').length
    const stale = filtered.filter((l) => l.lastContact && (l.lastContact.includes('5 dia') || l.lastContact.includes('18 dia'))).length
    return { total, totalValue, hot, stale }
  }, [filtered])

  function leadsForStage(stageName: string): MockLead[] {
    return filtered.filter((l) => l.stage === stageName)
  }

  function stageValue(stageName: string): number {
    return leadsForStage(stageName).reduce((s, l) => s + l.value, 0)
  }

  const chips: { key: FilterChip; label: string; activeColor: string; activeBg: string; activeBorder: string }[] = [
    { key: 'mine', label: 'Meus leads', activeColor: '#f97316', activeBg: 'rgba(249,115,22,0.15)', activeBorder: '#f97316' },
    { key: 'hot', label: '🔥 Quentes', activeColor: '#f97316', activeBg: 'rgba(249,115,22,0.15)', activeBorder: '#f97316' },
    { key: 'cold', label: '❄️ Frios', activeColor: '#3b82f6', activeBg: 'rgba(59,130,246,0.15)', activeBorder: '#3b82f6' },
    { key: 'overdue', label: '⏰ Atrasados', activeColor: '#ef4444', activeBg: 'rgba(239,68,68,0.15)', activeBorder: '#ef4444' },
    { key: 'stale', label: '😴 Parados +15d', activeColor: '#f59e0b', activeBg: 'rgba(245,158,11,0.15)', activeBorder: '#f59e0b' },
  ]

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <style>{SCROLLBAR_CSS}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Pipeline</h1>
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
          Novo Lead
        </button>
      </div>

      {/* Stats bar */}
      <div
        style={{
          background: '#161a22', border: '1px solid #22283a', borderRadius: 10,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 0,
          marginBottom: 16,
        }}
      >
        <StatItem label="Total de leads" value={String(stats.total)} />
        <StatSep />
        <StatItem label="Valor no pipeline" value={formatCurrency(stats.totalValue)} />
        <StatSep />
        <StatItem label="Leads quentes" value={`🔥 ${stats.hot}`} valueColor="#f97316" />
        <StatSep />
        <StatItem label="Sem interação +5d" value={String(stats.stale)} valueColor="#ef4444" />
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {chips.map((chip) => {
            const active = activeChips.has(chip.key)
            return (
              <button
                key={chip.key}
                onClick={() => toggleChip(chip.key)}
                style={{
                  borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? chip.activeBg : '#161a22',
                  border: `1px solid ${active ? chip.activeBorder : '#22283a'}`,
                  color: active ? chip.activeColor : '#9ca3af',
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#6b7280" strokeWidth={1.5}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lead ou empresa..."
              style={{
                width: 240, background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
                padding: '7px 12px 7px 32px', fontSize: 13, color: '#e8eaf0', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Pipeline selector */}
          <select
            style={{
              background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
              padding: '7px 28px 7px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none',
              cursor: 'pointer', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}
          >
            <option>Pipeline Principal</option>
          </select>
        </div>
      </div>

      {/* Board */}
      <div
        className="pipeline-board"
        style={{
          height: 'calc(100vh - 300px)',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
          <div
            style={{
              display: 'flex',
              gap: 12,
              height: '100%',
              paddingBottom: 8,
            }}
          >
            {stages.map((stage) => {
              const leads = leadsForStage(stage.name)
              const value = stageValue(stage.name)
              return (
                <div
                  key={stage.name}
                  className="col-wrap"
                  style={{
                    width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    background: '#0f1117', borderRadius: 12, maxHeight: '100%',
                  }}
                >
                  {/* Color bar */}
                  <div style={{ height: 3, borderRadius: '3px 3px 0 0', background: stage.color }} />

                  {/* Column header — fixed */}
                  <div style={{ padding: '12px 12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0' }}>{stage.name}</span>
                      <span
                        style={{
                          background: `${stage.color}1F`, color: stage.color,
                          borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {leads.length}
                      </span>
                    </div>
                    {value > 0 && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {formatCurrency(value)}
                      </div>
                    )}
                  </div>

                  {/* Column body — scrolls */}
                  <div
                    className="col-body"
                    style={{
                      flex: 1, overflowY: 'auto', padding: '0 8px 8px',
                      minHeight: 0,
                    }}
                  >
                    {leads.length === 0 ? (
                      <div
                        style={{
                          border: '1px dashed #22283a', borderRadius: 8,
                          padding: 20, textAlign: 'center', fontSize: 12, color: '#6b7280',
                        }}
                      >
                        Sem leads aqui
                      </div>
                    ) : (
                      leads.map((lead) => {
                        const temp = tempConfig[lead.temperature]
                        const isHovered = hoveredCard === lead.id
                        return (
                          <div
                            key={lead.id}
                            onMouseEnter={() => setHoveredCard(lead.id)}
                            onMouseLeave={() => setHoveredCard(null)}
                            style={{
                              background: isHovered ? '#1c2130' : '#161a22',
                              border: `1px solid ${isHovered ? '#374151' : '#22283a'}`,
                              borderRadius: 10, padding: 14, marginBottom: 8,
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            {/* Name + temp */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {lead.name}
                              </span>
                              <span style={{ background: temp.bg, color: temp.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {temp.label}
                              </span>
                            </div>

                            {/* Company */}
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{lead.company}</div>

                            {/* Value */}
                            {lead.value > 0 && (
                              <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 500, marginTop: 6 }}>
                                {formatCurrency(lead.value)}
                              </div>
                            )}

                            {/* Footer */}
                            <div style={{ marginTop: 10, borderTop: '1px solid #22283a', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {/* Avatar */}
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {lead.responsible}
                                </div>
                                {/* Last contact */}
                                {lead.lastContact && (
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                                    {lead.lastContact}
                                  </span>
                                )}
                              </div>
                              {/* Actions */}
                              <div style={{ display: 'flex', gap: 2 }}>
                                <ActionBtn color="#25d166"><MessageCircle size={14} strokeWidth={1.5} /></ActionBtn>
                                <ActionBtn color="#3b82f6"><Mail size={14} strokeWidth={1.5} /></ActionBtn>
                                <ActionBtn color="#f97316"><Phone size={14} strokeWidth={1.5} /></ActionBtn>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
      </div>
    </AppLayout>
  )
}

// ── Small sub-components ──

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? '#e8eaf0' }}>{value}</span>
    </div>
  )
}

function StatSep() {
  return <div style={{ width: 1, height: 20, background: '#22283a' }} />
}

function ActionBtn({ children, color }: { children: React.ReactNode; color: string }) {
  const [h, setH] = useState(false)
  return (
    <button
      type="button"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: h ? '#22283a' : 'transparent',
        border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}
