import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, MoreHorizontal, Kanban, List } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import NewLeadModal from '../../components/shared/NewLeadModal/NewLeadModal'

// ── Data ──

interface Lead {
  id: string
  name: string
  company: string
  stage: string
  temperature: string
  value: number
  responsible: string
  lastActivity: string
}

const stageColors: Record<string, string> = {
  'Sem Contato': '#6b7280',
  'Em Contato': '#3b82f6',
  'Negociando': '#f59e0b',
  'Proposta Enviada': '#a855f7',
  'Venda Realizada': '#22c55e',
  'Repescagem': '#f97316',
  'Perdido': '#ef4444',
}

const tempDisplay: Record<string, { label: string; color: string }> = {
  Quente: { label: '🔥 Quente', color: '#f97316' },
  Morno: { label: '🌤 Morno', color: '#f59e0b' },
  Frio: { label: '❄️ Frio', color: '#3b82f6' },
}

const mockLeads: Lead[] = [
  { id: '1', name: 'Camila Torres', company: 'Torres & Filhos', stage: 'Negociando', temperature: 'Quente', value: 12000, responsible: 'Ana Souza', lastActivity: 'há 2 dias' },
  { id: '2', name: 'Rafael Mendes', company: 'MendesNet', stage: 'Sem Contato', temperature: 'Frio', value: 8500, responsible: 'Pedro Gomes', lastActivity: 'há 8 dias' },
  { id: '3', name: 'Pedro Alves', company: 'Alves Tech', stage: 'Sem Contato', temperature: 'Morno', value: 5000, responsible: 'Lucas Castro', lastActivity: 'há 3 dias' },
  { id: '4', name: 'Fernanda Lima', company: 'Lima Distribuidora', stage: 'Em Contato', temperature: 'Quente', value: 18000, responsible: 'Ana Souza', lastActivity: 'hoje' },
  { id: '5', name: 'Marcos Oliveira', company: 'MO Serviços', stage: 'Em Contato', temperature: 'Frio', value: 5000, responsible: 'Pedro Gomes', lastActivity: 'há 18 dias' },
  { id: '6', name: 'Juliana Costa', company: 'Costa Digital', stage: 'Em Contato', temperature: 'Morno', value: 9500, responsible: 'Mariana Reis', lastActivity: 'há 4 dias' },
  { id: '7', name: 'Roberto Souza', company: 'RS Comércio', stage: 'Negociando', temperature: 'Quente', value: 32000, responsible: 'Ana Souza', lastActivity: 'há 1 dia' },
  { id: '8', name: 'Ana Paula Costa', company: 'Costa & Filhos', stage: 'Negociando', temperature: 'Morno', value: 12000, responsible: 'Lucas Castro', lastActivity: 'há 5 dias' },
  { id: '9', name: 'Thiago Bastos', company: 'Bastos & Co', stage: 'Negociando', temperature: 'Frio', value: 7500, responsible: 'Thiago Bastos', lastActivity: 'há 7 dias' },
  { id: '10', name: 'Priscila Gomes', company: 'GomesTech', stage: 'Proposta Enviada', temperature: 'Quente', value: 28000, responsible: 'Pedro Gomes', lastActivity: 'há 2 dias' },
  { id: '11', name: 'Diego Marques', company: 'Marquesali', stage: 'Proposta Enviada', temperature: 'Morno', value: 15000, responsible: 'Ana Souza', lastActivity: 'há 3 dias' },
  { id: '12', name: 'Juliana Torres', company: 'Torres Import', stage: 'Venda Realizada', temperature: 'Quente', value: 28000, responsible: 'Lucas Castro', lastActivity: 'hoje' },
  { id: '13', name: 'Bruno Salave', company: 'SalaGroup', stage: 'Repescagem', temperature: 'Morno', value: 19000, responsible: 'Mariana Reis', lastActivity: 'há 12 dias' },
  { id: '14', name: 'Carla Mendes', company: 'Mendes Soluções', stage: 'Perdido', temperature: 'Frio', value: 6000, responsible: 'Thiago Bastos', lastActivity: 'há 20 dias' },
  { id: '15', name: 'Lucas Ferreira', company: 'Ferreira & Cia', stage: 'Em Contato', temperature: 'Quente', value: 22000, responsible: 'Pedro Gomes', lastActivity: 'há 1 dia' },
]

const stageOptions = ['Todas', 'Sem Contato', 'Em Contato', 'Negociando', 'Proposta Enviada', 'Venda Realizada', 'Repescagem', 'Perdido']
const tempOptions = ['Todas', 'Quente', 'Morno', 'Frio']
const respOptions = ['Todos', 'Ana Souza', 'Pedro Gomes', 'Lucas Castro', 'Mariana Reis', 'Thiago Bastos']
const sortOptions = [{ v: 'recent', l: 'Mais recente' }, { v: 'value', l: 'Maior valor' }, { v: 'name', l: 'Nome A-Z' }]
const menuOpts = ['Ver detalhes', 'Editar', 'Mover etapa', 'Arquivar']

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
function ini(n: string) { return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

const dd: React.CSSProperties = {
  background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
  padding: '0 28px 0 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', height: 36,
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

// ── Component ──

export default function GestaoLeadsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [stageF, setStageF] = useState('Todas')
  const [tempF, setTempF] = useState('Todas')
  const [respF, setRespF] = useState('Todos')
  const [sortBy, setSortBy] = useState('recent')
  const [tab, setTab] = useState<'all' | 'active' | 'archived'>('all')
  const [menu, setMenu] = useState<string | null>(null)
  const [hov, setHov] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    let r = mockLeads.filter((l) => {
      const q = search.toLowerCase()
      if (q && !l.name.toLowerCase().includes(q) && !l.company.toLowerCase().includes(q)) return false
      if (stageF !== 'Todas' && l.stage !== stageF) return false
      if (tempF !== 'Todas' && l.temperature !== tempF) return false
      if (respF !== 'Todos' && l.responsible !== respF) return false
      if (tab === 'active' && (l.stage === 'Perdido' || l.stage === 'Venda Realizada')) return false
      if (tab === 'archived' && l.stage !== 'Perdido' && l.stage !== 'Venda Realizada') return false
      return true
    })
    if (sortBy === 'value') r = [...r].sort((a, b) => b.value - a.value)
    if (sortBy === 'name') r = [...r].sort((a, b) => a.name.localeCompare(b.name))
    return r
  }, [search, stageF, tempF, respF, sortBy, tab])

  const totalActive = mockLeads.filter(l => l.stage !== 'Perdido' && l.stage !== 'Venda Realizada').length
  const totalValue = mockLeads.reduce((s, l) => s + l.value, 0)
  const totalHot = mockLeads.filter(l => l.temperature === 'Quente').length

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0' }}>Leads</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => navigate('/gestao/pipeline')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #22283a', background: '#161a22', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Kanban size={14} strokeWidth={1.5} /> Kanban
            </button>
            <button style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'default', border: '1px solid #f97316', background: 'rgba(249,115,22,0.12)', color: '#f97316', display: 'flex', alignItems: 'center', gap: 4 }}>
              <List size={14} strokeWidth={1.5} /> Lista
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#161a22', color: '#9ca3af', border: '1px solid #22283a', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
            <Download size={15} strokeWidth={1.5} /> Importar
          </button>
          <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f97316' }}>
            <Plus size={15} strokeWidth={2} /> Novo Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>47</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativos</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{totalActive}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Valor total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{fmt(totalValue)}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Quentes</span><span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4 }}>🔥 {totalHot}</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
          <Search size={15} color="#6b7280" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou empresa..."
            style={{ width: '100%', background: '#161a22', border: '1px solid #22283a', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: '#e8eaf0', outline: 'none', height: 36, boxSizing: 'border-box' }} />
        </div>
        <select value={stageF} onChange={(e) => setStageF(e.target.value)} style={dd}>
          {stageOptions.map(s => <option key={s} value={s}>{s === 'Todas' ? 'Etapa' : s}</option>)}
        </select>
        <select value={tempF} onChange={(e) => setTempF(e.target.value)} style={dd}>
          {tempOptions.map(t => <option key={t} value={t}>{t === 'Todas' ? 'Temperatura' : t}</option>)}
        </select>
        <select value={respF} onChange={(e) => setRespF(e.target.value)} style={dd}>
          {respOptions.map(r => <option key={r} value={r}>{r === 'Todos' ? 'Responsável' : r}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={dd}>
          {sortOptions.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #22283a', marginBottom: 16 }}>
        {([['all', `Todos (47)`], ['active', `Ativos (${totalActive})`], ['archived', `Arquivados (${47 - totalActive})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13,
            color: tab === k ? '#f97316' : '#6b7280', fontWeight: tab === k ? 500 : 400,
            borderBottom: tab === k ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f1117' }}>
              {['Lead', 'Etapa', 'Temperatura', 'Valor', 'Responsável', 'Última atividade', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const sc = stageColors[l.stage] ?? '#6b7280'
              const td = tempDisplay[l.temperature]
              return (
                <tr key={l.id}
                  onClick={() => { if (menu !== l.id) navigate(`/gestao/leads/${l.id}`) }}
                  onMouseEnter={() => setHov(l.id)}
                  onMouseLeave={() => setHov(null)}
                  style={{ borderBottom: '1px solid #22283a', background: hov === l.id ? '#1c2130' : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}>
                  {/* Lead */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#22283a', fontSize: 11, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(l.name)}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{l.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{l.company}</div>
                      </div>
                    </div>
                  </td>
                  {/* Etapa */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ background: `${sc}1F`, color: sc, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{l.stage}</span>
                  </td>
                  {/* Temperatura */}
                  <td style={{ padding: '14px 20px', fontSize: 12, color: td?.color ?? '#6b7280' }}>{td?.label ?? l.temperature}</td>
                  {/* Valor */}
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: '#e8eaf0' }}>{fmt(l.value)}</td>
                  {/* Responsável */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#22283a', fontSize: 9, fontWeight: 700, color: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini(l.responsible)}</div>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{l.responsible}</span>
                    </div>
                  </td>
                  {/* Última atividade */}
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#6b7280' }}>{l.lastActivity}</td>
                  {/* Ações */}
                  <td style={{ padding: '14px 20px', position: 'relative' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenu(menu === l.id ? null : l.id) }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: menu === l.id ? '#22283a' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}
                      onMouseEnter={(e) => { if (menu !== l.id) e.currentTarget.style.background = '#22283a' }}
                      onMouseLeave={(e) => { if (menu !== l.id) e.currentTarget.style.background = 'transparent' }}>
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </button>
                    {menu === l.id && (
                      <div style={{ position: 'absolute', right: 20, top: 48, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 160, padding: '4px 0' }}>
                        {menuOpts.map(opt => (
                          <div key={opt}
                            onClick={(e) => { e.stopPropagation(); setMenu(null); if (opt === 'Ver detalhes') navigate(`/gestao/leads/${l.id}`) }}
                            style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaf0', cursor: 'pointer' }}
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
        <div style={{ padding: '12px 20px', borderTop: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Mostrando 1-{filtered.length} de 47 leads</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid #22283a', cursor: 'not-allowed', background: 'transparent', color: '#6b7280', opacity: 0.5 }}>Anterior</button>
            <button style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid #22283a', cursor: 'pointer', background: '#161a22', color: '#e8eaf0' }}>Próximo</button>
          </div>
        </div>
      </div>
      <NewLeadModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={() => setModalOpen(false)} />
    </AppLayout>
  )
}
