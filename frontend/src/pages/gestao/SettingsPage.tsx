import { useState } from 'react'
import { GripVertical, Plus, X, CheckSquare, Mail, Calendar, Globe, MoreHorizontal, Info, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import api from '../../services/api'

type Tab = 'pipeline' | 'loss' | 'tasks' | 'integrations'

// ── Shared styles ──

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

// ── Data ──

interface Stage { id: string; name: string; color: string; active: boolean; fixed: boolean }
const initialStages: Stage[] = [
  { id: 's1', name: 'Sem Contato', color: 'var(--text-muted)', active: true, fixed: false },
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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Configure seu pipeline e preferências</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13,
            color: tab === t.key ? '#f97316' : 'var(--text-muted)', fontWeight: tab === t.key ? 500 : 400,
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {pipelines.map(p => (
        <button key={p} onClick={() => setActivePipeline(p)} style={{
          borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          background: activePipeline === p ? 'rgba(249,115,22,0.12)' : 'var(--border)',
          border: `1px solid ${activePipeline === p ? '#f97316' : 'var(--border)'}`,
          color: activePipeline === p ? '#f97316' : 'var(--text-muted)', transition: 'all 0.15s',
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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Etapas — {activePipeline}</span>
      </div>
      {stages.map(s => (
        <div key={s.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <GripVertical size={16} color="var(--border)" style={{ cursor: 'grab', flexShrink: 0 }} />
          <div style={{ width: 4, height: 20, borderRadius: 2, background: s.color, flexShrink: 0 }} />
          <input value={s.name} onChange={e => renameSt(s.id, e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', outline: 'none' }} />
          {s.fixed && <span style={{ background: 'var(--border)', color: 'var(--text-muted)', borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>Fixa</span>}
          <div onClick={() => toggleStage(s.id)} style={{ width: 36, height: 20, borderRadius: 999, background: s.active ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: s.active ? 'flex-end' : 'flex-start', cursor: s.fixed ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: s.fixed ? 0.5 : 1 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: s.active ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
          </div>
          {!s.fixed && (
            <button onClick={() => removeStage(s.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ))}
      <button style={{ width: '100%', padding: 10, background: 'transparent', border: 'none', color: '#f97316', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Plus size={14} strokeWidth={1.5} /> Adicionar etapa
      </button>
      <div style={{ padding: '8px 20px 16px', fontSize: 12, color: 'var(--text-muted)' }}>As etapas Venda Realizada e Perdido são fixas e não podem ser removidas.</div>
    </div>

    {newFunnelModal && <NewFunnelModal onClose={() => setNewFunnelModal(false)} onCreate={handleCreateFunnel} currentCount={pipelines.length} />}
    </>
  )
}

// ── New Funnel Modal ──

function NewFunnelModal({ onClose, onCreate, currentCount }: { onClose: () => void; onCreate: (name: string) => void; currentCount: number }) {
  const [name, setName] = useState('')
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Criar novo funil</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do funil <span style={{ color: '#f97316' }}>*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pós-Venda, Parceiros, Franquias..." style={inputS} />
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            O novo funil começa com as 7 etapas padrão. Você pode personalizar depois.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Seu plano Pro permite até 10 funis. Você está usando {currentCount} de 10.</div>
        </div>
        <ModalFooter onClose={onClose} onSave={() => { if (name.trim()) onCreate(name.trim()) }} canSave={!!name.trim()} label="Criar funil" />
      </div>
    </>
  )
}

// ── Loss Reasons Tab ──

function LossReasonsTab() {
  const [reasons, setReasons] = useState(initialReasons)
  const [editing, setEditing] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)

  function remove(idx: number) { setReasons(p => p.filter((_, i) => i !== idx)) }
  function rename(idx: number, val: string) { setReasons(p => p.map((r, i) => i === idx ? val : r)) }

  function handleSaveReason(name: string) {
    if (editIdx !== null) {
      rename(editIdx, name)
      // API: api.patch(`/loss-reasons/${id}`, { name })
    } else {
      setReasons(p => [...p, name])
      // API: api.post('/loss-reasons', { name })
    }
    setModalOpen(false)
    setEditIdx(null)
  }

  function openEditModal(idx: number) {
    setEditIdx(idx)
    setModalOpen(true)
  }

  return (
    <>
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Motivos de Perda</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Obrigatório selecionar ao mover lead para Perdido</div>
          </div>
          <button onClick={() => { setEditIdx(null); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} strokeWidth={2} /> Adicionar motivo
          </button>
        </div>
        {reasons.map((r, i) => (
          <div key={i} style={{ padding: '12px 20px', borderBottom: i < reasons.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            {editing === i ? (
              <input autoFocus value={r} onChange={e => rename(i, e.target.value)} onBlur={() => setEditing(null)} onKeyDown={e => { if (e.key === 'Enter') setEditing(null) }}
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid #f97316', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }} />
            ) : (
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{r}</span>
            )}
            <button onClick={() => openEditModal(i)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
            <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
      {modalOpen && <LossReasonModal defaultValue={editIdx !== null ? reasons[editIdx] : ''} onClose={() => { setModalOpen(false); setEditIdx(null) }} onSave={handleSaveReason} isEdit={editIdx !== null} />}
    </>
  )
}

function LossReasonModal({ defaultValue, onClose, onSave, isEdit }: { defaultValue?: string; onClose: () => void; onSave: (name: string) => void; isEdit: boolean }) {
  const [name, setName] = useState(defaultValue ?? '')
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isEdit ? 'Editar motivo' : 'Novo motivo de perda'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do motivo <span style={{ color: '#f97316' }}>*</span></label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Preço alto" style={inputS} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }} />
        </div>
        <ModalFooter onClose={onClose} onSave={() => { if (name.trim()) onSave(name.trim()) }} canSave={!!name.trim()} label={isEdit ? 'Salvar' : 'Adicionar'} />
      </div>
    </>
  )
}

// ── Managerial Tasks Tab ──

function ManagerialTasksTab() {
  const [tasks, setTasks] = useState(mgrTasks)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function toggle(id: string) { setTasks(p => p.map(t => t.id === id ? { ...t, active: !t.active } : t)) }

  function handleCreate(name: string, recurrence: string) {
    const newTask: MgrTask = { id: `m${Date.now()}`, name, active: true, recurrence }
    setTasks(p => [...p, newTask])
    setModalOpen(false)
    // API: api.post('/managerial-task-types', { name, recurrence })
  }

  return (
    <>
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tipos de Tarefa Gerencial</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Tarefas criadas pelo gestor para a equipe — não vinculadas a leads</div>
          </div>
          <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} strokeWidth={2} /> Novo tipo
          </button>
        </div>
        {tasks.map(t => (
          <div key={t.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, opacity: t.active ? 1 : 0.6 }}>
            <CheckSquare size={16} color="#f97316" strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{t.name}</span>
            <span style={{ background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>{t.recurrence}</span>
            <div onClick={() => toggle(t.id)} style={{ width: 36, height: 20, borderRadius: 999, background: t.active ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: t.active ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.active ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
              {openMenu === t.id && (
                <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 130, padding: '4px 0' }}>
                  {['Editar', 'Excluir'].map(opt => <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {modalOpen && <NewTaskTypeModal onClose={() => setModalOpen(false)} onSave={handleCreate} />}
    </>
  )
}

function NewTaskTypeModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, recurrence: string) => void }) {
  const [name, setName] = useState('')
  const [recurrence, setRecurrence] = useState('Mensal')
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo tipo de tarefa</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do tipo <span style={{ color: '#f97316' }}>*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Feedback individual" style={inputS} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Recorrência padrão</label>
            <select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="Nenhuma">Nenhuma</option>
              <option value="Diária">Diária</option>
              <option value="Semanal">Semanal</option>
              <option value="Quinzenal">Quinzenal</option>
              <option value="Mensal">Mensal</option>
            </select>
          </div>
        </div>
        <ModalFooter onClose={onClose} onSave={() => { if (name.trim()) onSave(name.trim(), recurrence) }} canSave={!!name.trim()} label="Criar tipo" />
      </div>
    </>
  )
}

// ── Integrations Tab ──

function IntegrationsTab() {
  const [comingSoon, setComingSoon] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [toast, setToast] = useState('')

  // Check status on mount
  useState(() => {
    api.get('/oauth/google/status').then(res => {
      const data = res.data?.data
      if (data?.connected) { setGmailConnected(true); setGmailEmail(data.email) }
    }).catch(() => {})

    api.get('/oauth/calendar/status').then(res => {
      const data = res.data?.data
      if (data?.connected) { setCalendarConnected(true); setCalendarEmail(data.email) }
    }).catch(() => {})

    // Check URL params for successful connection
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    if (connected === 'gmail') {
      setGmailConnected(true)
      setToast('Gmail conectado com sucesso!')
      setTimeout(() => setToast(''), 4000)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (connected === 'calendar') {
      setCalendarConnected(true)
      setToast('Google Calendar conectado com sucesso!')
      setTimeout(() => setToast(''), 4000)
      window.history.replaceState({}, '', window.location.pathname)
    }
  })

  async function handleConnectGmail() {
    setGmailLoading(true)
    try {
      const res = await api.get('/oauth/google/authorize')
      const url = res.data?.data?.url
      if (url) window.location.href = url
    } catch { setGmailLoading(false) }
  }

  async function handleConnectCalendar() {
    setCalendarLoading(true)
    try {
      const res = await api.get('/oauth/calendar/authorize')
      const url = res.data?.data?.url
      if (url) window.location.href = url
    } catch { setCalendarLoading(false) }
  }

  function IntegrationCard({ icon: Icon, iconColor, iconBg, name, desc, connected, email, loading: isLoading, onConnect, btnLabel }: {
    icon: typeof Mail; iconColor: string; iconBg: string; name: string; desc: string
    connected: boolean; email: string | null; loading: boolean
    onConnect: () => void; btnLabel: string
  }) {
    return (
      <div style={{ background: 'var(--bg-card)', border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} color={iconColor} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
            <span style={{ fontSize: 10, fontWeight: 500, borderRadius: 999, padding: '2px 8px', background: connected ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: connected ? '#22c55e' : 'var(--text-muted)' }}>
              {connected ? 'Conectado' : 'Não conectado'}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>{desc}</p>
        {email && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>{email}</p>}
        {!email && <div style={{ marginBottom: 14 }} />}
        {connected ? (
          <button style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'default' }}>Conectado ✓</button>
        ) : (
          <button onClick={onConnect} disabled={isLoading} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isLoading ? 'Redirecionando...' : btnLabel}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <IntegrationCard icon={Mail} iconColor="#ef4444" iconBg="rgba(239,68,68,0.12)" name="Gmail" desc="Envie e-mails para leads diretamente pelo TriboCRM com rastreamento de abertura" connected={gmailConnected} email={gmailEmail} loading={gmailLoading} onConnect={handleConnectGmail} btnLabel="Conectar Gmail" />
        <IntegrationCard icon={Calendar} iconColor="#3b82f6" iconBg="rgba(59,130,246,0.12)" name="Google Calendar" desc="Crie eventos automaticamente ao agendar tarefas no TriboCRM" connected={calendarConnected} email={calendarEmail} loading={calendarLoading} onConnect={handleConnectCalendar} btnLabel="Conectar Calendar" />

        {/* Chrome Extension */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={20} color="#22c55e" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Extensão do Chrome</div>
              <span style={{ fontSize: 10, fontWeight: 500, borderRadius: 999, padding: '2px 8px', background: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)' }}>Não instalada</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>Capture leads do LinkedIn, Gmail e envie WhatsApp direto pelo CRM</p>
          <button onClick={() => setComingSoon(true)} style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Instalar extensão</button>
        </div>
      </div>
      {comingSoon && <ComingSoonModal onClose={() => setComingSoon(false)} />}
    </>
  )
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, padding: 24, textAlign: 'center' }}>
        <Info size={32} color="#3b82f6" strokeWidth={1.5} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Integração em breve</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>Esta funcionalidade será ativada em breve. Você receberá uma notificação quando estiver disponível.</p>
        <button onClick={onClose} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Entendi</button>
      </div>
    </>
  )
}

// ── Shared Modal Footer ──

function ModalFooter({ onClose, onSave, canSave, label }: { onClose: () => void; onSave: () => void; canSave: boolean; label: string }) {
  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
      <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
      <button onClick={onSave} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>{label}</button>
    </div>
  )
}
