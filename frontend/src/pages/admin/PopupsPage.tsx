import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import api from '../../services/api'

interface Popup {
  id: string; type: string; instances: string[]; plans: string[]
  message: string; buttonLabel: string | null; buttonUrl: string | null
  frequency: string; startDate: string; endDate: string | null
  imageUrl: string | null; isActive: boolean; createdAt: string
}

const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  'Inadimplência': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'Novidade': { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'Promoção': { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'Pesquisa': { color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  'Manutenção': { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'Boas-vindas': { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
}
const POPUP_TYPES = ['Inadimplência', 'Novidade', 'Promoção', 'Pesquisa', 'Manutenção', 'Boas-vindas']
const FREQUENCIES = ['A cada login', '1x por sessão', '1x por dia', '1x por semana', '1x por usuário']
const INSTANCE_OPTS = ['Gestor', 'Vendedor']
const PLAN_OPTS = ['Todos', 'Solo', 'Essencial', 'Pro', 'Enterprise']

const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const inputErr: React.CSSProperties = { ...inputS, borderColor: '#ef4444' }

function formatInstances(arr: string[]) {
  if (!arr.length || (arr.includes('Gestor') && arr.includes('Vendedor'))) return 'Todos'
  return arr.join(' + ')
}

function formatPeriod(p: Popup) {
  const s = new Date(p.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  if (!p.endDate) return `A partir de ${s}`
  const e = new Date(p.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${s} até ${e}`
}

export default function PopupsPage() {
  const [items, setItems] = useState<Popup[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchPopups = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/popups')
      if (data.success) setItems(data.data)
    } catch { showToast('Erro ao carregar pop-ups', 'err') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { fetchPopups() }, [fetchPopups])

  async function toggleStatus(id: string) {
    try {
      const { data } = await api.patch(`/admin/popups/${id}/toggle`)
      if (data.success) {
        setItems(prev => prev.map(p => p.id === id ? data.data : p))
        showToast(`Pop-up ${data.data.isActive ? 'ativado' : 'pausado'}!`)
      }
    } catch (e: any) { showToast(e.response?.data?.error?.message ?? 'Erro ao alterar status', 'err') }
  }

  function handleCreated(p: Popup) {
    setItems(prev => [p, ...prev])
    setModalOpen(false)
    showToast('Pop-up criado e ativado com sucesso!')
  }

  const counts = { total: items.length, active: items.filter(p => p.isActive).length, inactive: items.filter(p => !p.isActive).length }

  return (
    <AppLayout menuItems={adminMenuItems}>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `4px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast.msg}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pop-ups e Comunicados</h1>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Novo Pop-up</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 20 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{counts.total}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{counts.active}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Inativos</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{counts.inactive}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Nenhum pop-up criado ainda.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {items.map(p => {
            const ts = TYPE_STYLES[p.type] ?? { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' }
            return (
              <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', opacity: p.isActive ? 1 : 0.7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ background: ts.bg, color: ts.color, borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{p.type}</span>
                  <span style={{ background: p.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: p.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{p.isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Instância: {formatInstances(p.instances)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Frequência: {p.frequency}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Período: {formatPeriod(p)}</div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                  <button style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => toggleStatus(p.id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: p.isActive ? '#f59e0b' : '#22c55e', cursor: 'pointer' }}>
                    {p.isActive ? 'Pausar' : 'Ativar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && <NewPopupModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </AppLayout>
  )
}

function NewPopupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Popup) => void }) {
  const [type, setType] = useState(POPUP_TYPES[0])
  const [instances, setInstances] = useState<string[]>(['Gestor', 'Vendedor'])
  const [plans, setPlans] = useState<string[]>(['Todos'])
  const [message, setMessage] = useState('')
  const [buttonLabel, setButtonLabel] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [frequency, setFrequency] = useState(FREQUENCIES[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [popupMode, setPopupMode] = useState<'text' | 'image'>('text')
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande. Máximo 2MB.'); return }
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function toggleArr(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const missing = { type: !type, message: !message.trim(), frequency: !frequency, startDate: !startDate }
  const canSave = !missing.type && !missing.message && !missing.frequency && !missing.startDate

  async function handleSave() {
    setTouched(true)
    if (!canSave) return
    setSaving(true); setError('')
    try {
      const { data } = await api.post('/admin/popups', {
        type, instances, plans, message,
        buttonLabel: buttonLabel || null, buttonUrl: buttonUrl || null,
        frequency, startDate, endDate: endDate || null,
        imageUrl: imagePreview || null,
      })
      if (data.success) onCreated(data.data)
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao criar pop-up')
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Pop-up</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Mode selector */}
          <Fld label="Formato">
            <div style={{ display: 'flex', gap: 10 }}>
              {([{ k: 'text' as const, l: 'Padrão (texto)' }, { k: 'image' as const, l: 'Com imagem (criativo)' }]).map(m => (
                <label key={m.k} onClick={() => setPopupMode(m.k)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${popupMode === m.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {popupMode === m.k && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}
                  </div>
                  {m.l}
                </label>
              ))}
            </div>
          </Fld>
          {popupMode === 'image' && (
            <Fld label="Imagem do criativo">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handleImageFile} />
              {imagePreview ? (
                <div style={{ marginBottom: 8 }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
                  <button onClick={() => { setImagePreview(''); if (fileRef.current) fileRef.current.value = '' }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 6 }}>Remover imagem</button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 24, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Clique para selecionar imagem</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>JPG ou PNG, 16:9, mín 1200x675px, máx 2MB</div>
                </div>
              )}
            </Fld>
          )}
          <Fld label="Tipo *">
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...(touched && missing.type ? inputErr : inputS), appearance: 'none' as const, cursor: 'pointer' }}>
              {POPUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Fld>
          <Fld label="Instância">
            <div style={{ display: 'flex', gap: 8 }}>
              {INSTANCE_OPTS.map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={instances.includes(v)} onChange={() => toggleArr(instances, v, setInstances)} style={{ accentColor: '#f97316' }} />{v}
                </label>
              ))}
            </div>
          </Fld>
          <Fld label="Planos">
            <div style={{ display: 'flex', gap: 8 }}>
              {PLAN_OPTS.map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={plans.includes(v)} onChange={() => toggleArr(plans, v, setPlans)} style={{ accentColor: '#f97316' }} />{v}
                </label>
              ))}
            </div>
          </Fld>
          <Fld label="Mensagem *"><textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Mensagem do pop-up..." style={{ ...(touched && missing.message ? inputErr : inputS), resize: 'none' } as React.CSSProperties} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Botão de ação (label)"><input value={buttonLabel} onChange={e => setButtonLabel(e.target.value)} placeholder="Ex: Regularizar" style={inputS} /></Fld>
            <Fld label="URL do botão"><input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} placeholder="https://..." style={inputS} /></Fld>
          </div>
          <Fld label="Frequência *">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ ...(touched && missing.frequency ? inputErr : inputS), appearance: 'none' as const, cursor: 'pointer' }}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Data início *"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={touched && missing.startDate ? inputErr : inputS} /></Fld>
            <Fld label="Data fim"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputS} /></Fld>
          </div>
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Salvando...' : 'Salvar e ativar'}
          </button>
        </div>
      </div>
    </>
  )
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{label}</label>{children}</div>
}
