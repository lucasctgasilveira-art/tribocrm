import { useState } from 'react'
import { GraduationCap, PlayCircle, Moon, Info } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

interface MenuButton {
  icon: typeof GraduationCap
  title: string
  label: string
  url: string
  order: number
  active: boolean
}

const inputS: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const focusH = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = '#f97316'
  e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
}
const blurH = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}

const history = [
  { action: 'URL da Mentoria alterada', user: 'Tiago Alves', time: 'há 3 dias' },
  { action: 'Botão Treinamentos ativado', user: 'Tiago Alves', time: 'há 1 semana' },
  { action: "Label 'Mentoria' atualizado", user: 'Marina Costa', time: 'há 2 semanas' },
]

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: active ? '#f97316' : 'var(--border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: active ? 23 : 3,
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

function MenuPreviewItem({ icon: Icon, label }: { icon: typeof GraduationCap; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
      <Icon size={16} color="var(--text-secondary)" />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

export default function MenuInstanciasPage() {
  const [toast, setToast] = useState('')
  const [buttons, setButtons] = useState<MenuButton[]>([
    { icon: GraduationCap, title: 'Mentoria', label: 'Mentoria', url: 'https://mentoria.tribodevendas.com.br', order: 1, active: true },
    { icon: PlayCircle, title: 'Treinamentos', label: 'Treinamentos', url: 'https://treinamentos.tribodevendas.com.br', order: 2, active: true },
  ])

  function update(idx: number, patch: Partial<MenuButton>) {
    setButtons((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <AppLayout menuItems={adminMenuItems}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '4px solid #22c55e',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 13,
            color: 'var(--text-primary)',
            zIndex: 60,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}

      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Menu das Instâncias</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Configure os botões de Mentoria e Treinamentos exibidos para os clientes
        </p>
      </div>

      {/* aviso azul */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 24,
        }}
      >
        <Info size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#93c5fd' }}>
          Estes botões aparecem no menu lateral de todas as instâncias dos clientes (Gestor e Vendedor).
        </span>
      </div>

      {/* grid 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {buttons.map((btn, idx) => {
          const Icon = btn.icon
          return (
            <div
              key={btn.title}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              {/* card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={24} color="#f97316" />
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{btn.title}</span>
                </div>
                <Toggle active={btn.active} onToggle={() => update(idx, { active: !btn.active })} />
              </div>

              {/* fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Label do botão
                  </label>
                  <input
                    value={btn.label}
                    onChange={(e) => update(idx, { label: e.target.value })}
                    style={inputS}
                    onFocus={focusH}
                    onBlur={blurH}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    URL de destino
                  </label>
                  <input
                    value={btn.url}
                    onChange={(e) => update(idx, { url: e.target.value })}
                    style={inputS}
                    onFocus={focusH}
                    onBlur={blurH}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Ordem de exibição
                  </label>
                  <input
                    type="number"
                    value={btn.order}
                    onChange={(e) => update(idx, { order: Number(e.target.value) })}
                    style={{ ...inputS, width: 80 }}
                    onFocus={focusH}
                    onBlur={blurH}
                  />
                </div>
              </div>

              {/* preview */}
              <div style={{ marginTop: 16 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 8,
                  }}
                >
                  Preview — como aparece no menu:
                </span>
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{btn.label}</span>
                  </div>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    (ao passar o mouse fica laranja)
                  </span>
                </div>
              </div>

              {/* save */}
              <button
                onClick={() => showToast(`Botão de ${btn.title} atualizado!`)}
                style={{
                  width: '100%',
                  marginTop: 16,
                  background: '#f97316',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  borderRadius: 8,
                  padding: '10px 0',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Salvar
              </button>
            </div>
          )
        })}
      </div>

      {/* preview geral */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Preview do menu lateral dos clientes</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Veja como os botões aparecem no menu de Gestor e Vendedor
        </p>

        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 8,
            padding: 12,
            maxWidth: 220,
            margin: '16px auto 0',
          }}
        >
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 8px' }} />
          {buttons
            .filter((b) => b.active)
            .sort((a, b) => a.order - b.order)
            .map((b) => (
              <MenuPreviewItem key={b.title} icon={b.icon} label={b.label} />
            ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          <MenuPreviewItem icon={Moon} label="Modo escuro" />
        </div>
      </div>

      {/* histórico */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>Histórico de alterações</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{h.action}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{h.user}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0, minWidth: 90, textAlign: 'right' }}>{h.time}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
