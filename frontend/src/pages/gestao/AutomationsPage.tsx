import { useState } from 'react'
import {
  Plus, MoreHorizontal, CheckSquare, MessageCircle, Clock, Mail,
  Copy, Tag, X, type LucideIcon,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

// ── Types ──

interface Automation {
  id: string; icon: LucideIcon; iconColor: string; title: string; active: boolean
  trigger: string; action: string; executions: number; lastExec: string
}

// ── Data ──

const automations: Automation[] = [
  { id: '1', icon: CheckSquare, iconColor: '#f97316', title: 'Tarefa ao entrar em contato', active: true, trigger: 'Lead muda para "Em Contato"', action: 'Criar tarefa "Ligar para o lead" em 24h', executions: 47, lastExec: 'hoje 14:32' },
  { id: '2', icon: MessageCircle, iconColor: '#25d166', title: 'WhatsApp de boas-vindas', active: true, trigger: 'Lead entra no pipeline (qualquer etapa)', action: 'Enviar modelo "Primeiro contato WhatsApp"', executions: 89, lastExec: 'hoje 09:15' },
  { id: '3', icon: Clock, iconColor: '#f59e0b', title: 'Alerta de inatividade — Quente', active: true, trigger: 'Lead Quente sem atividade há 2 dias', action: 'Notificar vendedor responsável', executions: 23, lastExec: 'ontem 08:00' },
  { id: '4', icon: Mail, iconColor: '#3b82f6', title: 'E-mail de follow-up — Proposta', active: true, trigger: 'Lead em "Proposta Enviada" sem atividade há 3 dias', action: 'Enviar modelo "Follow-up proposta 3 dias"', executions: 12, lastExec: 'há 2 dias' },
  { id: '5', icon: Copy, iconColor: '#a855f7', title: 'Duplicar para pós-venda', active: true, trigger: 'Lead chega em "Venda Realizada"', action: 'Duplicar card para funil "Pós-Venda"', executions: 8, lastExec: 'há 3 dias' },
  { id: '6', icon: Clock, iconColor: '#6b7280', title: 'Alerta de inatividade — Morno', active: false, trigger: 'Lead Morno sem atividade há 5 dias', action: 'Notificar vendedor + criar tarefa de follow-up', executions: 31, lastExec: 'há 5 dias' },
  { id: '7', icon: MessageCircle, iconColor: '#6b7280', title: 'WhatsApp aniversário do vendedor', active: false, trigger: 'Data de nascimento do vendedor', action: 'Enviar mensagem de parabéns configurada', executions: 3, lastExec: '15/03/2026' },
  { id: '8', icon: Tag, iconColor: '#6b7280', title: 'Tag automática — Lead Frio', active: false, trigger: 'Lead sem atividade há 10 dias', action: 'Alterar temperatura para Frio automaticamente', executions: 19, lastExec: 'há 4 dias' },
]

const menuOpts = ['Editar', 'Duplicar', 'Ver execuções', 'Excluir']

const triggerOpts = ['Selecione o gatilho...', 'Lead muda de etapa', 'Lead fica X dias sem atividade', 'Lead chega em Venda Realizada', 'Lead chega em Perdido', 'Lead entra no pipeline', 'Data de aniversário do vendedor', 'Lead muda de temperatura']
const actionOpts = ['Selecione a ação...', 'Criar tarefa para o responsável', 'Enviar modelo de WhatsApp', 'Enviar modelo de e-mail', 'Notificar vendedor', 'Alterar temperatura do lead', 'Duplicar lead para outro funil']

const dd: React.CSSProperties = {
  background: '#161a22', border: '1px solid #22283a', borderRadius: 8,
  padding: '6px 28px 6px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none',
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

const inputS: React.CSSProperties = { width: '100%', background: '#111318', border: '1px solid #22283a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }

// ── Component ──

export default function AutomationsPage() {
  const [items, setItems] = useState(automations)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function toggleActive(id: string) {
    setItems(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  const activeCount = items.filter(a => a.active).length
  const pausedCount = items.filter(a => !a.active).length

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Automações</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Regras automáticas de follow-up e ações</p>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Nova Automação
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{items.length}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativas</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{activeCount}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Pausadas</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{pausedCount}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Execuções este mês</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>127</span>
      </div>

      {/* Pipeline selector */}
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: '#6b7280', marginRight: 8 }}>Pipeline:</span>
        <select style={dd}><option>Pipeline Principal</option></select>
      </div>

      {/* Cards */}
      {items.map(a => {
        const Icon = a.icon
        return (
          <div key={a.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, marginBottom: 12, opacity: a.active ? 1 : 0.7 }}>
            {/* Row 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${a.iconColor}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={a.iconColor} strokeWidth={1.5} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', flex: 1 }}>{a.title}</span>
              <span style={{ background: a.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: a.active ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>
                {a.active ? 'Ativa' : 'Pausada'}
              </span>
              {/* Toggle */}
              <div onClick={() => toggleActive(a.id)} style={{
                width: 36, height: 20, borderRadius: 999, cursor: 'pointer',
                background: a.active ? '#f97316' : '#22283a',
                display: 'flex', alignItems: 'center', padding: '0 2px',
                justifyContent: a.active ? 'flex-end' : 'flex-start', transition: 'all 0.2s',
              }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: a.active ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
              </div>
              {/* Menu */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: openMenu === a.id ? '#22283a' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                  <MoreHorizontal size={14} strokeWidth={1.5} />
                </button>
                {openMenu === a.id && (
                  <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 150, padding: '4px 0' }}>
                    {menuOpts.map(opt => (
                      <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Excluir' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Row 2-3 */}
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4, paddingLeft: 44 }}>
              <span style={{ color: '#6b7280' }}>Quando: </span>{a.trigger}
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8, paddingLeft: 44 }}>
              <span style={{ color: '#6b7280' }}>Ação: </span>{a.action}
            </div>
            {/* Row 4 */}
            <div style={{ fontSize: 12, color: '#6b7280', paddingLeft: 44 }}>
              Executada {a.executions}x · Última execução: {a.lastExec}
            </div>
          </div>
        )
      })}

      {/* Modal */}
      {modalOpen && <NewAutomationModal onClose={() => setModalOpen(false)} />}
    </AppLayout>
  )
}

// ── Modal ──

function NewAutomationModal({ onClose }: { onClose: () => void }) {
  const [trigger, setTrigger] = useState('')
  const [action, setAction] = useState('')
  const [name, setName] = useState('')
  const [days, setDays] = useState('2')
  const [temp, setTemp] = useState('Quente')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskType, setTaskType] = useState('Ligação')
  const [taskDeadline, setTaskDeadline] = useState('24')

  const isInactivity = trigger === 'Lead fica X dias sem atividade'
  const isCreateTask = action === 'Criar tarefa para o responsável'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: '#161a22', border: '1px solid #22283a', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Nova Automação</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Trigger */}
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Quando isso acontecer</div>
          <select value={trigger} onChange={e => setTrigger(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer', marginBottom: 12 }}>
            {triggerOpts.map(t => <option key={t} value={t === triggerOpts[0] ? '' : t}>{t}</option>)}
          </select>

          {isInactivity && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="number" value={days} onChange={e => setDays(e.target.value)} style={{ ...inputS, width: 80 }} />
              <span style={{ color: '#9ca3af', fontSize: 13, alignSelf: 'center' }}>dias sem atividade</span>
              <select value={temp} onChange={e => setTemp(e.target.value)} style={{ ...inputS, width: 120, appearance: 'none' as const, cursor: 'pointer' }}>
                <option>Quente</option><option>Morno</option><option>Frio</option><option>Qualquer</option>
              </select>
            </div>
          )}

          {/* Action */}
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, marginTop: 16, fontWeight: 600 }}>Então fazer isso</div>
          <select value={action} onChange={e => setAction(e.target.value)} style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer', marginBottom: 12 }}>
            {actionOpts.map(a => <option key={a} value={a === actionOpts[0] ? '' : a}>{a}</option>)}
          </select>

          {isCreateTask && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Título da tarefa" style={inputS} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={taskType} onChange={e => setTaskType(e.target.value)} style={{ ...inputS, flex: 1, appearance: 'none' as const, cursor: 'pointer' }}>
                  <option>Ligação</option><option>E-mail</option><option>Reunião</option><option>WhatsApp</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} style={{ ...inputS, width: 60 }} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>horas</span>
                </div>
              </div>
            </div>
          )}

          {/* Name */}
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, marginTop: 16, fontWeight: 600 }}>Nome da automação <span style={{ color: '#f97316' }}>*</span></div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Follow-up automático 3 dias" style={inputS} />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #22283a', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Cancelar</button>
          <button disabled={!name.trim() || !trigger || !action} style={{
            background: name.trim() && trigger && action ? '#f97316' : '#22283a', border: 'none', borderRadius: 8,
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            color: name.trim() && trigger && action ? '#fff' : '#6b7280',
            cursor: name.trim() && trigger && action ? 'pointer' : 'not-allowed',
          }}>Salvar Automação</button>
        </div>
      </div>
    </>
  )
}
