import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Loader2, Plus, ChevronDown, Search } from 'lucide-react'

// ── Types ──

export interface PhoneEntry { ddi: string; number: string }

export interface NewLeadData {
  name: string; company: string; position: string; email: string
  phones: PhoneEntry[]; cpf: string; cnpj: string; pipeline: string; stage: string
  value: string; responsible: string; responsibleId: string; source: string; temperature: string; notes: string
  // compat
  phone: string; phoneDdi: string
}

export interface UserOption { id: string; name: string }
export type DistributionType = 'MANUAL' | 'ROUND_ROBIN_ALL' | 'ROUND_ROBIN_TEAM' | 'SPECIFIC_USER'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: NewLeadData) => void
  defaultStage?: string
  users?: UserOption[]
  pipelineDistribution?: DistributionType
}
type FieldStatus = 'idle' | 'valid' | 'error'

// ── Countries ──

interface Country { code: string; flag: string; name: string; ddi: string; mask: string }

const countries: Country[] = [
  { code:'BR', flag:'\u{1F1E7}\u{1F1F7}', name:'Brasil', ddi:'+55', mask:'(00) 00000-0000' },
  { code:'US', flag:'\u{1F1FA}\u{1F1F8}', name:'Estados Unidos', ddi:'+1', mask:'(000) 000-0000' },
  { code:'AR', flag:'\u{1F1E6}\u{1F1F7}', name:'Argentina', ddi:'+54', mask:'(000) 000-0000' },
  { code:'PT', flag:'\u{1F1F5}\u{1F1F9}', name:'Portugal', ddi:'+351', mask:'000 000 000' },
  { code:'ES', flag:'\u{1F1EA}\u{1F1F8}', name:'Espanha', ddi:'+34', mask:'000 000 000' },
  { code:'MX', flag:'\u{1F1F2}\u{1F1FD}', name:'México', ddi:'+52', mask:'(000) 000-0000' },
  { code:'CO', flag:'\u{1F1E8}\u{1F1F4}', name:'Colômbia', ddi:'+57', mask:'000 000 0000' },
  { code:'CL', flag:'\u{1F1E8}\u{1F1F1}', name:'Chile', ddi:'+56', mask:'(0) 0000 0000' },
  { code:'PE', flag:'\u{1F1F5}\u{1F1EA}', name:'Peru', ddi:'+51', mask:'000 000 000' },
  { code:'UY', flag:'\u{1F1FA}\u{1F1FE}', name:'Uruguai', ddi:'+598', mask:'0000 0000' },
  { code:'PY', flag:'\u{1F1F5}\u{1F1FE}', name:'Paraguai', ddi:'+595', mask:'(000) 000 000' },
  { code:'BO', flag:'\u{1F1E7}\u{1F1F4}', name:'Bolívia', ddi:'+591', mask:'0000 0000' },
  { code:'VE', flag:'\u{1F1FB}\u{1F1EA}', name:'Venezuela', ddi:'+58', mask:'(000) 000-0000' },
  { code:'EC', flag:'\u{1F1EA}\u{1F1E8}', name:'Equador', ddi:'+593', mask:'00 000 0000' },
  { code:'GB', flag:'\u{1F1EC}\u{1F1E7}', name:'Reino Unido', ddi:'+44', mask:'0000 000000' },
  { code:'DE', flag:'\u{1F1E9}\u{1F1EA}', name:'Alemanha', ddi:'+49', mask:'000 00000000' },
  { code:'FR', flag:'\u{1F1EB}\u{1F1F7}', name:'França', ddi:'+33', mask:'00 00 00 00 00' },
  { code:'IT', flag:'\u{1F1EE}\u{1F1F9}', name:'Itália', ddi:'+39', mask:'000 000 0000' },
  { code:'CA', flag:'\u{1F1E8}\u{1F1E6}', name:'Canadá', ddi:'+1', mask:'(000) 000-0000' },
  { code:'AU', flag:'\u{1F1E6}\u{1F1FA}', name:'Austrália', ddi:'+61', mask:'0000 000 000' },
  { code:'JP', flag:'\u{1F1EF}\u{1F1F5}', name:'Japão', ddi:'+81', mask:'00-0000-0000' },
  { code:'CN', flag:'\u{1F1E8}\u{1F1F3}', name:'China', ddi:'+86', mask:'000 0000 0000' },
  { code:'IN', flag:'\u{1F1EE}\u{1F1F3}', name:'Índia', ddi:'+91', mask:'00000 00000' },
  { code:'ZA', flag:'\u{1F1FF}\u{1F1E6}', name:'África do Sul', ddi:'+27', mask:'00 000 0000' },
  { code:'AO', flag:'\u{1F1E6}\u{1F1F4}', name:'Angola', ddi:'+244', mask:'000 000 000' },
  { code:'MZ', flag:'\u{1F1F2}\u{1F1FF}', name:'Moçambique', ddi:'+258', mask:'00 000 0000' },
  { code:'CH', flag:'\u{1F1E8}\u{1F1ED}', name:'Suíça', ddi:'+41', mask:'000 000 00 00' },
  { code:'NL', flag:'\u{1F1F3}\u{1F1F1}', name:'Holanda', ddi:'+31', mask:'00 0000 0000' },
  { code:'BE', flag:'\u{1F1E7}\u{1F1EA}', name:'Bélgica', ddi:'+32', mask:'000 00 00 00' },
  { code:'SE', flag:'\u{1F1F8}\u{1F1EA}', name:'Suécia', ddi:'+46', mask:'00-000 00 00' },
]

function findCountry(ddi: string): Country { return countries.find(c => c.ddi === ddi) ?? countries[0]! }

// ── Config ──

const stageOpts = ['Sem Contato', 'Em Contato', 'Negociando', 'Proposta Enviada']
const respOpts = ['Ana Souza', 'Pedro Gomes', 'Lucas Castro', 'Mariana Reis', 'Thiago Bastos']
const sourceOpts = ['Instagram', 'LinkedIn', 'Indicação', 'Site', 'WhatsApp', 'Cold Call', 'Outro']
const tempOpts = ['Quente', 'Morno', 'Frio']

// ── Validators & Masks ──

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validarCPF(raw: string): boolean {
  const c = raw.replace(/\D/g, '')
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let s = 0; for (let i = 0; i < 9; i++) s += parseInt(c[i]!) * (10 - i)
  let r = (s * 10) % 11; if (r >= 10) r = 0; if (r !== parseInt(c[9]!)) return false
  s = 0; for (let i = 0; i < 10; i++) s += parseInt(c[i]!) * (11 - i)
  r = (s * 10) % 11; if (r >= 10) r = 0; return r === parseInt(c[10]!)
}

function validarCNPJ(raw: string): boolean {
  const c = raw.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const calc = (len: number) => { let n = 0, p = len + 1; for (let i = 0; i < len; i++) { n += parseInt(c[i]!) * p--; if (p < 2) p = 9 }; const r = n % 11; return r < 2 ? 0 : 11 - r }
  return calc(12) === parseInt(c[12]!) && calc(13) === parseInt(c[13]!)
}

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d; if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d; if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function maskPhone(v: string, ddi: string): string {
  const d = v.replace(/\D/g, '')
  if (ddi === '+55') { const s = d.slice(0,11); if (s.length<=2) return s; if (s.length<=7) return `(${s.slice(0,2)}) ${s.slice(2)}`; return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}` }
  if (ddi === '+1' || ddi === '+54' || ddi === '+52' || ddi === '+58') { const s = d.slice(0,10); if (s.length<=3) return s; if (s.length<=6) return `(${s.slice(0,3)}) ${s.slice(3)}`; return `(${s.slice(0,3)}) ${s.slice(3,6)}-${s.slice(6)}` }
  // generic: group by 3-4
  const s = d.slice(0, 11); const parts: string[] = []
  for (let i = 0; i < s.length; i += 3) parts.push(s.slice(i, i + 3))
  return parts.join(' ')
}

// ── Styles ──

const CSS = `
  @keyframes modalFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes modalScaleIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  .nlm-body::-webkit-scrollbar{width:4px}.nlm-body::-webkit-scrollbar-track{background:transparent}
  .nlm-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}.nlm-body{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
`

function getInputStyle(status: FieldStatus): React.CSSProperties {
  const b = status === 'error' ? '#ef4444' : status === 'valid' ? '#22c55e' : 'var(--border)'
  const sh = status === 'error' ? '0 0 0 3px rgba(239,68,68,0.10)' : status === 'valid' ? '0 0 0 3px rgba(34,197,94,0.10)' : 'none'
  return { width: '100%', background: 'var(--bg-surface)', border: `1px solid ${b}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s, box-shadow 0.2s', boxShadow: sh }
}
const baseInput = getInputStyle('idle')
function focusEv(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) { e.target.style.borderColor = '#f97316'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)' }
function blurEv(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

// ── Phone Input Component ──

function PhoneInput({ entry, onChange, onRemove, showRemove }: { entry: PhoneEntry; onChange: (e: PhoneEntry) => void; onRemove?: () => void; showRemove: boolean }) {
  const [dropOpen, setDropOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const country = findCountry(entry.ddi)

  useEffect(() => {
    function close(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropOpen(false) }
    if (dropOpen) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropOpen])

  const filtered = search ? countries.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.ddi.includes(search)) : countries

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
      {/* Country selector */}
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button type="button" onClick={() => setDropOpen(!dropOpen)} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px 0 0 8px',
          padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          height: '100%', color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'nowrap', minWidth: 90,
        }}>
          <span style={{ fontSize: 16 }}>{country.flag}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{country.ddi}</span>
          <ChevronDown size={12} color="var(--text-muted)" strokeWidth={1.5} />
        </button>

        {dropOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 280, maxHeight: 240,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px' }}>
                <Search size={14} color="var(--text-muted)" strokeWidth={1.5} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar país..."
                  autoFocus style={{ background: 'transparent', border: 'none', padding: '10px 0', fontSize: 13, color: 'var(--text-primary)', outline: 'none', width: '100%' }} />
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.map(c => (
                <div key={c.code + c.ddi} onClick={() => { onChange({ ddi: c.ddi, number: '' }); setDropOpen(false); setSearch('') }}
                  style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ fontSize: 18 }}>{c.flag}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 12 }}>{c.ddi}</span>
                </div>
              ))}
              {filtered.length === 0 && <div style={{ padding: 14, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Nenhum país encontrado</div>}
            </div>
          </div>
        )}
      </div>

      {/* Number input */}
      <input value={entry.number}
        onChange={e => onChange({ ...entry, number: maskPhone(e.target.value, entry.ddi) })}
        placeholder={country.mask}
        style={{ ...baseInput, borderRadius: '0 8px 8px 0', borderLeft: 'none', flex: 1 }}
        onFocus={focusEv} onBlur={blurEv} />

      {/* Remove button */}
      {showRemove && (
        <button type="button" onClick={onRemove} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 6px', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}

// ── Main Component ──

export default function NewLeadModal({ open, onClose, onSubmit, defaultStage, users, pipelineDistribution = 'MANUAL' }: Props) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [email, setEmail] = useState('')
  const [phones, setPhones] = useState<PhoneEntry[]>([{ ddi: '+55', number: '' }])
  const [cpf, setCpf] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [pipeline] = useState('Pipeline Principal')
  const [stage, setStage] = useState(defaultStage ?? 'Sem Contato')
  const [value, setValue] = useState('')
  // When a real users list is provided, the dropdown stores a UUID; otherwise
  // (legacy callers without props) it falls back to the hardcoded mock list.
  const useRealUsers = Array.isArray(users) && users.length > 0
  const isAutoDistribution = pipelineDistribution !== 'MANUAL'
  const [responsibleId, setResponsibleId] = useState<string>('')
  const [responsible, setResponsible] = useState(respOpts[0] ?? '')
  const [source, setSource] = useState('')
  const [temperature, setTemperature] = useState('Morno')
  const [notes, setNotes] = useState('')

  const [emailStatus, setEmailStatus] = useState<FieldStatus>('idle')
  const [emailErr, setEmailErr] = useState('')
  const [cpfStatus, setCpfStatus] = useState<FieldStatus>('idle')
  const [cpfErr, setCpfErr] = useState('')
  const [cnpjStatus, setCnpjStatus] = useState<FieldStatus>('idle')
  const [cnpjErr, setCnpjErr] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(''); setCompany(''); setPosition(''); setEmail(''); setPhones([{ ddi: '+55', number: '' }])
      setCpf(''); setCnpj(''); setStage(defaultStage ?? 'Sem Contato'); setValue(''); setSource(''); setNotes('')
      setResponsible(respOpts[0] ?? ''); setResponsibleId(''); setTemperature('Morno')
      setSaving(false); setEmailStatus('idle'); setEmailErr(''); setCpfStatus('idle'); setCpfErr(''); setCnpjStatus('idle'); setCnpjErr('')
      setTimeout(() => nameRef.current?.focus(), 100)
    }
  }, [open, defaultStage])

  const flashValid = useCallback((setter: (s: FieldStatus) => void) => { setter('valid'); setTimeout(() => setter('idle'), 1000) }, [])

  function validateEmail() {
    if (!email) { setEmailStatus('idle'); setEmailErr(''); return }
    if (emailRe.test(email)) { flashValid(setEmailStatus); setEmailErr('') } else { setEmailStatus('error'); setEmailErr('Digite um e-mail válido') }
  }
  function validateCpf() {
    const raw = cpf.replace(/\D/g, '')
    if (!raw) { setCpfStatus('idle'); setCpfErr(''); return }
    if (raw.length < 11) { setCpfStatus('error'); setCpfErr('CPF incompleto'); return }
    if (validarCPF(cpf)) { flashValid(setCpfStatus); setCpfErr('') } else { setCpfStatus('error'); setCpfErr('CPF inválido') }
  }
  function validateCnpj() {
    const raw = cnpj.replace(/\D/g, '')
    if (!raw) { setCnpjStatus('idle'); setCnpjErr(''); return }
    if (raw.length < 14) { setCnpjStatus('error'); setCnpjErr('CNPJ incompleto'); return }
    if (validarCNPJ(cnpj)) { flashValid(setCnpjStatus); setCnpjErr('') } else { setCnpjStatus('error'); setCnpjErr('CNPJ inválido') }
  }

  function updatePhone(idx: number, entry: PhoneEntry) { setPhones(p => p.map((ph, i) => i === idx ? entry : ph)) }
  function addPhone() { if (phones.length < 3) setPhones(p => [...p, { ddi: '+55', number: '' }]) }
  function removePhone(idx: number) { setPhones(p => p.filter((_, i) => i !== idx)) }

  const hasErr = (email.length > 0 && emailStatus === 'error') || (cpf.replace(/\D/g, '').length > 0 && cpfStatus === 'error') || (cnpj.replace(/\D/g, '').length > 0 && cnpjStatus === 'error')
  const responsibleOk = isAutoDistribution || (useRealUsers ? true : !!responsible)
  const canSubmit = name.trim() && email.trim() && emailRe.test(email) && responsibleOk && !hasErr && !saving

  if (!open) return null

  function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setTimeout(() => {
      onSubmit({ name, company, position, email, phones, phone: phones[0]?.number ?? '', phoneDdi: phones[0]?.ddi ?? '+55', cpf, cnpj, pipeline, stage, value, responsible, responsibleId, source, temperature, notes })
      setSaving(false); onClose()
    }, 400)
  }

  return (
    <>
      <style>{CSS}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, animation: 'modalFadeIn 0.2s ease-out' }} />

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'modalScaleIn 0.2s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div><h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Lead</h2><p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Preencha os dados do novo lead</p></div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Body */}
        <div className="nlm-body" style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <SectionLabel>Dados do contato</SectionLabel>
          <div style={{ marginBottom: 4 }}>
            <Field label="Nome completo" required>
              <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do lead" style={baseInput} onFocus={focusEv} onBlur={blurEv} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Empresa"><input value={company} onChange={e => setCompany(e.target.value)} placeholder="Nome da empresa" style={baseInput} onFocus={focusEv} onBlur={blurEv} /></Field>
            <Field label="Cargo"><input value={position} onChange={e => setPosition(e.target.value)} placeholder="Cargo / função" style={baseInput} onFocus={focusEv} onBlur={blurEv} /></Field>

            <Field label="E-mail" required error={emailErr}>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); if (emailStatus !== 'idle') setEmailStatus('idle') }}
                placeholder="email@empresa.com" style={getInputStyle(emailStatus)}
                onFocus={e => { focusEv(e); setEmailStatus('idle'); setEmailErr('') }} onBlur={e => { blurEv(e); validateEmail() }} />
            </Field>

            {/* Phones */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Telefone / WhatsApp">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {phones.map((ph, i) => (
                    <PhoneInput key={i} entry={ph} onChange={e => updatePhone(i, e)} onRemove={() => removePhone(i)} showRemove={phones.length > 1} />
                  ))}
                  {phones.length < 3 && (
                    <button type="button" onClick={addPhone} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f97316', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
                      <Plus size={14} strokeWidth={1.5} /> Adicionar outro telefone
                    </button>
                  )}
                </div>
              </Field>
            </div>

            <Field label="CPF" error={cpfErr}>
              <input value={cpf} onChange={e => { setCpf(maskCPF(e.target.value)); if (cpfStatus !== 'idle') setCpfStatus('idle') }}
                placeholder="000.000.000-00" style={getInputStyle(cpfStatus)}
                onFocus={e => { focusEv(e); setCpfStatus('idle'); setCpfErr('') }} onBlur={e => { blurEv(e); validateCpf() }} />
            </Field>
            <Field label="CNPJ" error={cnpjErr}>
              <input value={cnpj} onChange={e => { setCnpj(maskCNPJ(e.target.value)); if (cnpjStatus !== 'idle') setCnpjStatus('idle') }}
                placeholder="00.000.000/0001-00" style={getInputStyle(cnpjStatus)}
                onFocus={e => { focusEv(e); setCnpjStatus('idle'); setCnpjErr('') }} onBlur={e => { blurEv(e); validateCnpj() }} />
            </Field>
          </div>

          <SectionLabel style={{ marginTop: 20 }}>Dados da negociação</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Pipeline" required><select value={pipeline} disabled style={{ ...baseInput, appearance: 'none' as const, cursor: 'default', opacity: 0.7 }}><option>Pipeline Principal</option></select></Field>
            <Field label="Etapa" required><select value={stage} onChange={e => setStage(e.target.value)} style={{ ...baseInput, appearance: 'none' as const, cursor: 'pointer' }} onFocus={focusEv} onBlur={blurEv}>{stageOpts.map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Valor esperado (R$)"><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" style={baseInput} onFocus={focusEv} onBlur={blurEv} /></Field>
            <Field label="Responsável" required={!isAutoDistribution}>
              {isAutoDistribution ? (
                <div style={{ ...baseInput, display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontStyle: 'italic', cursor: 'not-allowed', background: 'var(--bg)' }}>
                  Será atribuído automaticamente conforme regra do pipeline
                </div>
              ) : useRealUsers ? (
                <select value={responsibleId} onChange={e => setResponsibleId(e.target.value)} style={{ ...baseInput, appearance: 'none' as const, cursor: 'pointer' }} onFocus={focusEv} onBlur={blurEv}>
                  <option value="">Eu mesmo</option>
                  {users!.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <select value={responsible} onChange={e => setResponsible(e.target.value)} style={{ ...baseInput, appearance: 'none' as const, cursor: 'pointer' }} onFocus={focusEv} onBlur={blurEv}>
                  {respOpts.map(r => <option key={r}>{r}</option>)}
                </select>
              )}
            </Field>
            <Field label="Fonte do lead"><select value={source} onChange={e => setSource(e.target.value)} style={{ ...baseInput, appearance: 'none' as const, cursor: 'pointer' }} onFocus={focusEv} onBlur={blurEv}><option value="">Selecionar...</option>{sourceOpts.map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Temperatura"><select value={temperature} onChange={e => setTemperature(e.target.value)} style={{ ...baseInput, appearance: 'none' as const, cursor: 'pointer' }} onFocus={focusEv} onBlur={blurEv}>{tempOpts.map(t => <option key={t}>{t}</option>)}</select></Field>
          </div>

          <SectionLabel style={{ marginTop: 20 }}>Observações</SectionLabel>
          <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações iniciais..." style={{ ...baseInput, resize: 'none' as const }}
            onFocus={e => { e.target.style.borderColor = '#f97316'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }} />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={!canSubmit} style={{
            background: canSubmit ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600,
            color: canSubmit ? '#fff' : 'var(--text-muted)', cursor: canSubmit ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s',
          }} onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = '#fb923c' }}
             onMouseLeave={e => { e.currentTarget.style.background = canSubmit ? '#f97316' : 'var(--border)' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Criando...' : 'Criar Lead'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12, fontWeight: 600, ...style }}>{children}</div>
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#f97316', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{error}</div>}
    </div>
  )
}
