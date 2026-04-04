import { useState } from 'react'
import { GripVertical, Plus, X, CheckSquare, Mail, Calendar, Globe, MoreHorizontal } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

type Tab = 'pipeline' | 'loss' | 'tasks' | 'integrations'

// ── Data ──

interface Stage { id: string; name: string; color: string; active: boolean; fixed: boolean }
const initialStages: Stage[] = [
  { id: 's1', name: 'Sem Contato', color: '#6b7280', active: true, fixed: false },
  { id: 's2', name: 'Em Contato', color: '#3b82f6', active: true, fixed: false },
  { id: 's3', name: 'Negociando', color: '#f59e0b', active: true, fixed: false },
  { id: 's4', name: 'Proposta Enviada', color: '#a855f7', active: true, fixed: false },
  { id: 's5', name: 'Venda Realizada', color: '#22c55e', active: true, fixed: true },
  { id: 's6', name: 'Repescagem', color: '#f97316', active: true, fixed: false },
  { id: 's7', name: 'Perdido', color: '#ef4444', active: true, fixed: true },
]

const initialReasons = ['Preço alto', 'Sem orçamento no momento', 'Escolheu concorrente', 'Sem interesse', 'Sem retorno', 'Timing errado']

interface MgrTask { id: string; name: string; active: boolean; recurrence: string }
const mgrTasks: MgrTask[] = [
  { id: 'm1', name: 'Feedback individual com vendedor', active: true, recurrence: 'Quinzenal' },
  { id: 'm2', name: 'Reunião de alinhamento do time', active: true, recurrence: 'Semanal' },
  { id: 'm3', name: 'Análise de relatório mensal', active: true, recurrence: 'Mensal' },
  { id: 'm4', name: 'Treinamento interno', active: true, recurrence: 'Mensal' },
  { id: 'm5', name: '1:1 com liderança', active: false, recurrence: 'Mensal' },
]

const card: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }

// ── Component ──

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('pipeline')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'loss', label: 'Motivos de Perda' },
    { key: 'tasks', label: 'Tarefas Gerenciais' },
    { key: 'integrations', label: 'Integrações' },
  ]

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Configure seu pipeline e preferências</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #22283a', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13,
            color: tab === t.key ? '#f97316' : '#6b7280', fontWeight: tab === t.key ? 500 : 400,
            borderBottom: tab === t.key ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'loss' && <LossReasonsTab />}
      {tab === 'tasks' && <ManagerialTasksTab />}
      {tab === 'integrations' && <IntegrationsTab />}
    </AppLayout>
  )
}

// ── Pipeline Tab ──

function PipelineTab() {
  const [stages, setStages] = useState(initialStages)
  const [pipelines, setPipelines] = useState(['Pipeline Principal', 'Pós-Venda'])
  const [activePipeline, setActivePipeline] = useState('Pipeline Principal')
  const [newFunnelModal, setNewFunnelModal] = useState(false)

  function toggleStage(id: string) { setStages(p => p.map(s => s.id === id && !s.fixed ? { ...s, active: !s.active } : s)) }
  function removeStage(id: string) { setStages(p => p.filter(s => s.id !== id)) }
  function renameSt(id: string, name: string) { setStages(p => p.map(s => s.id === id ? { ...s, name } : s)) }

  function handleCreateFunnel(name: string) {
    setPipelines(p => [...p, name])
    setActivePipeline(name)
    setNewFunnelModal(false)
  }

  return (
    <>
    {/* Pipeline pills */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {pipelines.map(p => (
        <button key={p} onClick={() => setActivePipeline(p)} style={{
          borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          background: activePipeline === p ? 'rgba(249,115,22,0.12)' : '#22283a',
          border: `1px solid ${activePipeline === p ? '#f97316' : '#22283a'}`,
          color: activePipeline === p ? '#f97316' : '#6b7280', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {p}{activePipeline === p && ' ✓'}
        </button>
      ))}
      <button onClick={() => setNewFunnelModal(true)} style={{
        borderRadius: 999, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
        background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316',
        display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
      }}>
        <Plus size={13} strokeWidth={1.5} /> Novo Funil
      </button>
    </div>

    <div style={card}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Etapas — {activePipeline}</span>
      </div>
      {stages.map(s => (
        <div key={s.id} style={{ padding: '14px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <GripVertical size={16} color="#22283a" style={{ cursor: 'grab', flexShrink: 0 }} />
          <div style={{ width: 4, height: 20, borderRadius: 2, background: s.color, flexShrink: 0 }} />
          <input value={s.name} onChange={e => renameSt(s.id, e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, fontWeight: 500, color: '#e8eaf0', outline: 'none' }} />
          {s.fixed && <span style={{ background: '#22283a', color: '#6b7280', borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>Fixa</span>}
          <div onClick={() => toggleStage(s.id)} style={{ width: 36, height: 20, borderRadius: 999, background: s.active ? '#f97316' : '#22283a', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: s.active ? 'flex-end' : 'flex-start', cursor: s.fixed ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: s.fixed ? 0.5 : 1 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: s.active ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
          </div>
          {!s.fixed && (
            <button onClick={() => removeStage(s.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.color = '#6b7280' }}>
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ))}
      <button style={{ width: '100%', padding: 10, background: 'transparent', border: 'none', color: '#f97316', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Plus size={14} strokeWidth={1.5} /> Adicionar etapa
      </button>
      <div style={{ padding: '8px 20px 16px', fontSize: 12, color: '#6b7280' }}>As etapas Venda Realizada e Perdido são fixas e não podem ser removidas.</div>
    </div>

    {newFunnelModal && <NewFunnelModal onClose={() => setNewFunnelModal(false)} onCreate={handleCreateFunnel} currentCount={pipelines.length} />}
    </>
  )
}

// ── New Funnel Modal ──

function NewFunnelModal({ onClose, onCreate, currentCount }: { onClose: () => void; onCreate: (name: string) => void; currentCount: number }) {
  const [name, setName] = useState('')
  const inputS: React.CSSProperties = { width: '100%', background: '#111318', border: '1px solid #22283a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: '#161a22', border: '1px solid #22283a', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Criar novo funil</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Nome do funil <span style={{ color: '#f97316' }}>*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pós-Venda, Parceiros, Franquias..." style={inputS} />
          </div>
          <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: 12, fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
            O novo funil começa com as 7 etapas padrão. Você pode personalizar depois.
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Seu plano Pro permite até 10 funis. Você está usando {currentCount} de 10.
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (name.trim()) onCreate(name.trim()) }} disabled={!name.trim()} style={{ background: name.trim() ? '#f97316' : '#22283a', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() ? '#fff' : '#6b7280', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Criar funil</button>
        </div>
      </div>
    </>
  )
}

// ── Loss Reasons Tab ──

function LossReasonsTab() {
  const [reasons, setReasons] = useState(initialReasons)
  const [editing, setEditing] = useState<number | null>(null)

  function remove(idx: number) { setReasons(p => p.filter((_, i) => i !== idx)) }
  function rename(idx: number, val: string) { setReasons(p => p.map((r, i) => i === idx ? val : r)) }

  return (
    <div style={card}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Motivos de Perda</span>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Obrigatório selecionar ao mover lead para Perdido</div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} strokeWidth={2} /> Adicionar motivo
        </button>
      </div>
      {reasons.map((r, i) => (
        <div key={i} style={{ padding: '12px 20px', borderBottom: i < reasons.length - 1 ? '1px solid #22283a' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          {editing === i ? (
            <input autoFocus value={r} onChange={e => rename(i, e.target.value)} onBlur={() => setEditing(null)} onKeyDown={e => { if (e.key === 'Enter') setEditing(null) }}
              style={{ flex: 1, background: '#111318', border: '1px solid #f97316', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#e8eaf0', outline: 'none' }} />
          ) : (
            <span style={{ flex: 1, fontSize: 13, color: '#e8eaf0' }}>{r}</span>
          )}
          <button onClick={() => setEditing(i)} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
          <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.color = '#6b7280' }}>
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Managerial Tasks Tab ──

function ManagerialTasksTab() {
  const [tasks, setTasks] = useState(mgrTasks)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  function toggle(id: string) { setTasks(p => p.map(t => t.id === id ? { ...t, active: !t.active } : t)) }

  return (
    <div style={card}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Tipos de Tarefa Gerencial</span>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Tarefas criadas pelo gestor para a equipe — não vinculadas a leads</div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} strokeWidth={2} /> Novo tipo
        </button>
      </div>
      {tasks.map(t => (
        <div key={t.id} style={{ padding: '14px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', gap: 12, opacity: t.active ? 1 : 0.6 }}>
          <CheckSquare size={16} color="#f97316" strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: '#e8eaf0', fontWeight: 500 }}>{t.name}</span>
          <span style={{ background: '#22283a', color: '#9ca3af', borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>{t.recurrence}</span>
          <div onClick={() => toggle(t.id)} style={{ width: 36, height: 20, borderRadius: 999, background: t.active ? '#f97316' : '#22283a', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: t.active ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.active ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              <MoreHorizontal size={14} strokeWidth={1.5} />
            </button>
            {openMenu === t.id && (
              <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 130, padding: '4px 0' }}>
                {['Editar', 'Excluir'].map(opt => <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Integrations Tab ──

function IntegrationsTab() {
  const integrations = [
    { icon: Mail, iconColor: '#ef4444', name: 'Gmail', connected: false, connectedLabel: '', desc: 'Envie e-mails para leads diretamente pelo TriboCRM com rastreamento de abertura', btnLabel: 'Conectar Gmail', btnStyle: 'orange' as const },
    { icon: Calendar, iconColor: '#3b82f6', name: 'Google Calendar', connected: false, connectedLabel: '', desc: 'Crie eventos automaticamente ao agendar tarefas no TriboCRM', btnLabel: 'Conectar Calendar', btnStyle: 'orange' as const },
    { icon: Globe, iconColor: '#22c55e', name: 'Extensão do Chrome', connected: false, connectedLabel: 'Não instalada', desc: 'Capture leads do LinkedIn, Gmail e envie WhatsApp direto pelo CRM', btnLabel: 'Instalar extensão', btnStyle: 'green' as const, link: 'Ver na Chrome Web Store →' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {integrations.map(ig => {
        const Icon = ig.icon
        return (
          <div key={ig.name} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ig.iconColor}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={ig.iconColor} strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{ig.name}</div>
                <span style={{
                  fontSize: 10, fontWeight: 500, borderRadius: 999, padding: '2px 8px',
                  background: ig.connected ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                  color: ig.connected ? '#22c55e' : '#6b7280',
                }}>{ig.connectedLabel || (ig.connected ? 'Conectado' : 'Não conectado')}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>{ig.desc}</p>
            {ig.btnStyle === 'orange' && <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{ig.btnLabel}</button>}
            {ig.btnStyle === 'green' && (
              <>
                <button style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>{ig.btnLabel}</button>
                {ig.link && <div style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>{ig.link}</div>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
