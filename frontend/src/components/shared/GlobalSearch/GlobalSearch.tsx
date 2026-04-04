import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Phone, Mail } from 'lucide-react'

interface SearchResult {
  group: string
  items: {
    type: 'lead' | 'task' | 'contact'
    initials?: string
    icon?: typeof Phone
    iconColor?: string
    title: string
    subtitle: string
    badge?: string
    badgeColor?: string
    url: string
  }[]
}

const mockResults: SearchResult[] = [
  {
    group: 'LEADS',
    items: [
      { type: 'lead', initials: 'CT', title: 'Camila Torres', subtitle: 'Torres & Filhos', badge: 'Negociando', badgeColor: '#f59e0b', url: '/gestao/leads/1' },
      { type: 'lead', initials: 'RM', title: 'Rafael Mendes', subtitle: 'MendesNet', badge: 'Sem Contato', badgeColor: 'var(--text-muted)', url: '/gestao/leads/2' },
    ],
  },
  {
    group: 'TAREFAS',
    items: [
      { type: 'task', icon: Phone, iconColor: '#f97316', title: 'Follow-up sobre desconto — Camila Torres', subtitle: 'Atrasada · 14:00', url: '/gestao/tarefas' },
      { type: 'task', icon: Mail, iconColor: '#3b82f6', title: 'Enviar proposta — GomesTech', subtitle: 'Hoje · 15:30', url: '/gestao/tarefas' },
    ],
  },
  {
    group: 'CONTATOS',
    items: [
      { type: 'contact', initials: 'PG', title: 'Pedro Gomes', subtitle: 'Vendedor · Time Sul', url: '/gestao/equipe/usuarios' },
    ],
  },
]

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  function handleSelect(url: string) {
    onClose()
    navigate(url)
  }

  const showResults = query.trim().length > 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '20vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '90vw',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Search size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar leads, tarefas, contatos..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 16,
              color: 'var(--text-primary)',
            }}
          />
          <span
            style={{
              background: 'var(--border)',
              color: 'var(--text-muted)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            ESC
          </span>
        </div>

        {/* body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!showResults ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 8px' }}>
                Busque por leads, tarefas ou contatos
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
                Dica: use ↑↓ para navegar e Enter para abrir
              </p>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {mockResults.map((group) => (
                <div key={group.group}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '12px 20px 4px',
                    }}
                  >
                    {group.group}
                  </div>
                  {group.items.map((item, i) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={i}
                        onClick={() => handleSelect(item.url)}
                        style={{
                          padding: '10px 20px',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* avatar or icon */}
                        {item.initials ? (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              flexShrink: 0,
                            }}
                          >
                            {item.initials}
                          </div>
                        ) : Icon ? (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: `${item.iconColor}1F`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={16} color={item.iconColor} />
                          </div>
                        ) : null}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</div>
                          <div
                            style={{
                              fontSize: 12,
                              color: item.subtitle.includes('Atrasada') ? '#ef4444' : 'var(--text-muted)',
                              marginTop: 1,
                            }}
                          >
                            {item.subtitle}
                          </div>
                        </div>

                        {item.badge && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 500,
                              color: item.badgeColor,
                              background: `${item.badgeColor}1F`,
                              borderRadius: 999,
                              padding: '2px 8px',
                              flexShrink: 0,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`::placeholder { color: var(--text-muted) !important; }`}</style>
    </div>
  )
}
