import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

interface Popup { id: string; name: string; type: string; typeColor: string; typeBg: string; instance: string; message: string; frequency: string; period: string; status: 'Ativo' | 'Pausado' | 'Agendado' }

const popups: Popup[] = [
  { id: '1', name: 'Aviso de inadimplência D+2', type: 'Inadimplência', typeColor: '#ef4444', typeBg: 'rgba(239,68,68,0.12)', instance: 'Gestor + Vendedor', message: 'Sua assinatura venceu. Regularize para manter acesso...', frequency: 'A cada login', period: 'Permanente', status: 'Ativo' },
  { id: '2', name: 'Novidade — Pipeline Kanban v2', type: 'Novidade', typeColor: '#3b82f6', typeBg: 'rgba(59,130,246,0.12)', instance: 'Todos', message: 'Conheça as melhorias do nosso Pipeline...', frequency: '1x por usuário', period: '01/04 até 30/04', status: 'Ativo' },
  { id: '3', name: 'Upgrade para Pro', type: 'Promoção', typeColor: '#f97316', typeBg: 'rgba(249,115,22,0.12)', instance: 'Plano Essencial', message: 'Aproveite 15% de desconto no upgrade para Pro...', frequency: '1x por dia', period: '01/04 até 15/04', status: 'Ativo' },
  { id: '4', name: 'Pesquisa NPS', type: 'Pesquisa', typeColor: '#a855f7', typeBg: 'rgba(168,85,247,0.12)', instance: 'Todos', message: 'Como está sua experiência com o TriboCRM?', frequency: '1x por semana', period: 'Permanente', status: 'Pausado' },
  { id: '5', name: 'Manutenção programada', type: 'Manutenção', typeColor: '#f59e0b', typeBg: 'rgba(245,158,11,0.12)', instance: 'Todos', message: 'O sistema ficará indisponível das 02h às 04h...', frequency: 'A cada login', period: '10/04', status: 'Pausado' },
  { id: '6', name: 'Boas-vindas novos clientes', type: 'Boas-vindas', typeColor: '#22c55e', typeBg: 'rgba(34,197,94,0.12)', instance: 'Todos', message: 'Bem-vindo ao TriboCRM! Veja como começar...', frequency: '1x por usuário', period: 'A partir de 10/04', status: 'Agendado' },
]

const statusS: Record<string, { bg: string; color: string }> = { Ativo: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' }, Pausado: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' }, Agendado: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' } }
const inputS: React.CSSProperties = { width: '100%', background: '#111318', border: '1px solid #22283a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8eaf0', outline: 'none', boxSizing: 'border-box' }

export default function PopupsPage() {
  const [items, setItems] = useState(popups)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState('')

  function toggleStatus(id: string) {
    setItems(p => p.map(pp => {
      if (pp.id !== id) return pp
      const next = pp.status === 'Ativo' ? 'Pausado' : 'Ativo'
      setToast(`Pop-up ${next === 'Ativo' ? 'ativado' : 'pausado'}!`); setTimeout(() => setToast(''), 2500)
      return { ...pp, status: next as Popup['status'] }
    }))
  }

  const counts = { total: items.length, active: items.filter(p => p.status === 'Ativo').length, paused: items.filter(p => p.status === 'Pausado').length, scheduled: items.filter(p => p.status === 'Agendado').length }

  return (
    <AppLayout menuItems={adminMenuItems}>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: '#161a22', border: '1px solid #22283a', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#e8eaf0', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Pop-ups e Comunicados</h1>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Novo Pop-up</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 20 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{counts.total}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{counts.active}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Pausados</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>{counts.paused}</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Agendados</span><span style={{ color: '#3b82f6', fontWeight: 700, marginLeft: 4 }}>{counts.scheduled}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {items.map(p => { const s = statusS[p.status]!; return (
          <div key={p.id} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', opacity: p.status === 'Pausado' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ background: p.typeBg, color: p.typeColor, borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{p.type}</span>
              <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{p.status}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 6 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Instância: {p.instance}</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.message}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Frequência: {p.frequency}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>Período: {p.period}</div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
              <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>Editar</button>
              <button onClick={() => toggleStatus(p.id)} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: p.status === 'Ativo' ? '#f59e0b' : '#22c55e', cursor: 'pointer' }}>
                {p.status === 'Ativo' ? 'Pausar' : 'Ativar'}
              </button>
            </div>
          </div>
        )})}
      </div>

      {modalOpen && <NewPopupModal onClose={() => setModalOpen(false)} />}
    </AppLayout>
  )
}

function NewPopupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: '#161a22', border: '1px solid #22283a', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #22283a', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Novo Pop-up</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <Fld label="Nome interno *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Aviso de inadimplência" style={inputS} /></Fld>
          <Fld label="Tipo"><select style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}><option>Inadimplência</option><option>Novidade</option><option>Promoção</option><option>Pesquisa</option><option>Manutenção</option><option>Boas-vindas</option></select></Fld>
          <Fld label="Instância"><div style={{ display: 'flex', gap: 8 }}>{['Gestor', 'Vendedor', 'Ambos'].map(v => <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#e8eaf0', cursor: 'pointer' }}><input type="checkbox" defaultChecked={v === 'Ambos'} style={{ accentColor: '#f97316' }} />{v}</label>)}</div></Fld>
          <Fld label="Planos"><div style={{ display: 'flex', gap: 8 }}>{['Todos', 'Solo', 'Essencial', 'Pro', 'Enterprise'].map(v => <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#e8eaf0', cursor: 'pointer' }}><input type="checkbox" defaultChecked={v === 'Todos'} style={{ accentColor: '#f97316' }} />{v}</label>)}</div></Fld>
          <Fld label="Mensagem"><textarea rows={4} placeholder="Mensagem do pop-up..." style={{ ...inputS, resize: 'none' }} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Botão de ação (label)"><input placeholder="Ex: Regularizar" style={inputS} /></Fld>
            <Fld label="URL do botão"><input placeholder="https://..." style={inputS} /></Fld>
          </div>
          <Fld label="Frequência"><select style={{ ...inputS, appearance: 'none' as const, cursor: 'pointer' }}><option>A cada login</option><option>1x por sessão</option><option>1x por dia</option><option>1x por semana</option><option>1x por usuário</option></select></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Data início"><input type="date" style={inputS} /></Fld>
            <Fld label="Data fim"><input type="date" style={inputS} /></Fld>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #22283a', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Cancelar</button>
          <button disabled={!name.trim()} style={{ background: name.trim() ? '#f97316' : '#22283a', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() ? '#fff' : '#6b7280', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Salvar e ativar</button>
        </div>
      </div>
    </>
  )
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{label}</label>{children}</div>
}
