import { useState, useEffect, type CSSProperties } from 'react'
import { Loader2, Download } from 'lucide-react'

// Shared period filter used by every report / dashboard screen that
// needs the same "Hoje / Esta semana / Este mês / Trimestre / Ano /
// Personalizado" switcher. Each caller owns its own PeriodValue state
// and re-fetches on onChange — this component is pure UI.
//
// The backend accepts startDate + endDate on every report endpoint
// (reports.controller.getDateRange short-circuits to the custom range
// when both are present), so the "Personalizado" branch just forwards
// the two date strings verbatim.

export type PeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export interface PeriodValue {
  period: PeriodKey
  startDate?: string // 'YYYY-MM-DD'
  endDate?: string   // 'YYYY-MM-DD'
}

interface PeriodPickerProps {
  value: PeriodValue
  onChange: (value: PeriodValue) => void
  showExport?: boolean
  onExport?: () => void
  exportLoading?: boolean
}

const PILLS: { key: PeriodKey; label: string }[] = [
  { key: 'today',   label: 'Hoje' },
  { key: 'week',    label: 'Esta semana' },
  { key: 'month',   label: 'Este mês' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'year',    label: 'Ano' },
  { key: 'custom',  label: 'Personalizado' },
]

const pill = (active: boolean): CSSProperties => ({
  borderRadius: 999,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  background: active ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
  border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
  color: active ? '#f97316' : 'var(--text-secondary)',
  transition: 'all 0.15s',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
})

const dateInput: CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
}

const exportBtn = (loading: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: loading ? 'rgba(249,115,22,0.4)' : '#f97316',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  transition: 'background 0.15s',
})

export function PeriodPicker({ value, onChange, showExport = false, onExport, exportLoading = false }: PeriodPickerProps) {
  const isCustom = value.period === 'custom'
  const [draftStart, setDraftStart] = useState(value.startDate ?? '')
  const [draftEnd, setDraftEnd] = useState(value.endDate ?? '')

  // Mirror external value changes back into the local draft so the
  // inputs stay in sync if the parent resets the picker from outside.
  useEffect(() => {
    setDraftStart(value.startDate ?? '')
    setDraftEnd(value.endDate ?? '')
  }, [value.startDate, value.endDate])

  function selectPill(key: PeriodKey) {
    if (key === 'custom') {
      onChange({ period: 'custom', startDate: draftStart || undefined, endDate: draftEnd || undefined })
      return
    }
    onChange({ period: key })
  }

  function handleDraftStart(v: string) {
    setDraftStart(v)
    // Fire onChange automatically once BOTH dates are filled; the
    // parent's useEffect will re-fetch. While only one is set we
    // stay silent to avoid spamming the backend with invalid ranges.
    if (v && draftEnd) onChange({ period: 'custom', startDate: v, endDate: draftEnd })
  }
  function handleDraftEnd(v: string) {
    setDraftEnd(v)
    if (draftStart && v) onChange({ period: 'custom', startDate: draftStart, endDate: v })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PILLS.map(p => {
            const active = value.period === p.key
            return (
              <button key={p.key} type="button" onClick={() => selectPill(p.key)} style={pill(active)}>
                {p.label}
              </button>
            )
          })}
        </div>
        {showExport && onExport && (
          <div style={{ marginLeft: 'auto' }}>
            <button type="button" onClick={onExport} disabled={exportLoading} style={exportBtn(exportLoading)} title="Exportar relatório em Excel">
              {exportLoading ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> : <Download size={14} strokeWidth={1.5} />}
              Exportar Excel
            </button>
          </div>
        )}
      </div>

      {isCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            De:
            <input type="date" value={draftStart} onChange={(e) => handleDraftStart(e.target.value)} style={dateInput} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            Até:
            <input type="date" value={draftEnd} onChange={(e) => handleDraftEnd(e.target.value)} style={dateInput} />
          </label>
          {(!draftStart || !draftEnd) && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Selecione as duas datas para aplicar o período personalizado
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default PeriodPicker
