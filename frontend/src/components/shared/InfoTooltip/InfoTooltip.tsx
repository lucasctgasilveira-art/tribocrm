import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

/**
 * Tooltip leve pra explicar conceitos pontuais ao usuário sem tirar
 * o foco do formulário.
 *
 * Comportamento:
 *   - Hover abre, sair do conjunto ícone+balão fecha (mouse-friendly)
 *   - Click também alterna (touch-friendly + acessibilidade)
 *   - Click fora fecha (click-outside detection)
 *   - Esc fecha (acessibilidade)
 *
 * Z-index 100 funciona dentro de modais (que ficam em 50-51 nesta UI).
 *
 * Uso:
 *   <label>
 *     Quando entra na divisão? <InfoTooltip>Texto explicativo</InfoTooltip>
 *   </label>
 */
export default function InfoTooltip({
  children,
  width = 260,
}: {
  children: React.ReactNode
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ display: 'inline-flex', position: 'relative', verticalAlign: 'middle', marginLeft: 4 }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
        aria-label="Mais informações"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'help',
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: 0,
        }}
      >
        <Info size={13} strokeWidth={1.5} />
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: -4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-dropdown)',
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            width,
            zIndex: 100,
            cursor: 'default',
            fontWeight: 400,
            textTransform: 'none',
            letterSpacing: 0,
            whiteSpace: 'normal',
          }}
        >
          {children}
        </div>
      )}
    </span>
  )
}
