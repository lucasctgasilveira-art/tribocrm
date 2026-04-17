import { useMemo, useState, type CSSProperties, type ChangeEvent, type FocusEvent } from 'react'
import { Check, XCircle } from 'lucide-react'
import { formatDocument, detectDocumentType, validateDocument, stripDocument } from '../../../utils/validateDocument'

interface DocumentInputProps {
  value: string
  onChange: (formatted: string) => void
  // Fires once the user leaves the field — parents use it to gate
  // submit. `valid=true` means digit-check + length + shape all pass.
  onValidityChange?: (valid: boolean) => void
  // Lets the parent force an error state (e.g. after a server 400
  // that flagged this field). Bypasses the internal touched flag.
  forceError?: string | null
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

const inputBase: CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  paddingRight: 40,
}

// Dynamic CPF/CNPJ input. Keeps its own `touched` flag so the red/
// green feedback only appears after the user has interacted at least
// once — typing "001" shouldn't flash a red border immediately. The
// mask itself switches between CPF shape (≤11 digits) and CNPJ shape
// (12-14 digits) as the user types, mirroring `formatDocument`.
export default function DocumentInput({
  value,
  onChange,
  onValidityChange,
  forceError,
  disabled,
  autoFocus,
  id,
}: DocumentInputProps) {
  const [touched, setTouched] = useState(false)

  const digits = stripDocument(value)
  const detected = detectDocumentType(value)
  const result = useMemo(() => validateDocument(value), [value])

  // Label reflects what the mask currently looks like, not what the
  // user eventually has to type. Saves a beat of confusion when
  // someone starts typing a CNPJ expecting "CPF/CNPJ" to flip.
  const label = detected === 'CPF' ? 'CPF' : detected === 'CNPJ' ? 'CNPJ' : 'CPF/CNPJ'
  const placeholder = digits.length <= 11 ? '000.000.000-00' : '00.000.000/0000-00'

  const showError = !!forceError || (touched && digits.length > 0 && !result.valid)
  const showSuccess = !forceError && touched && result.valid

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const formatted = formatDocument(e.target.value)
    onChange(formatted)
    // While typing we only re-broadcast validity so the submit button
    // can flip as soon as the 11th/14th digit lands. The border stays
    // quiet until blur.
    if (onValidityChange) onValidityChange(validateDocument(formatted).valid)
  }

  function handleBlur(_e: FocusEvent<HTMLInputElement>) {
    setTouched(true)
    if (onValidityChange) onValidityChange(result.valid)
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
  }

  const borderColor = showError ? '#ef4444' : showSuccess ? '#22c55e' : 'var(--border)'
  const focusColor = showError ? '#ef4444' : showSuccess ? '#22c55e' : '#f97316'

  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
        {label} <span style={{ color: '#f97316' }}>*</span>
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={(e) => { e.target.style.borderColor = focusColor; handleFocus(e) }}
          onBlur={(e) => { e.target.style.borderColor = borderColor; e.target.style.boxShadow = 'none'; handleBlur(e) }}
          style={{ ...inputBase, borderColor }}
        />
        {showSuccess && (
          <Check
            size={18}
            color="#22c55e"
            strokeWidth={2}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
        )}
        {showError && (
          <XCircle
            size={18}
            color="#ef4444"
            strokeWidth={1.8}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
        )}
      </div>
      {showError && (
        <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>
          {forceError || result.error}
        </div>
      )}
      {!showError && !showSuccess && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Pessoa física: CPF. Pessoa jurídica: CNPJ.
        </div>
      )}
    </div>
  )
}
