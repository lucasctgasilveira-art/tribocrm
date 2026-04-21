import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  getMyTenant,
  updateMyTenant,
  type MyTenant,
  type UpdateMyTenantPayload,
} from '../../services/tenant.service'
import { invalidateCurrentTenantCache } from '../../hooks/useCurrentTenant'

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const inputDisabled: React.CSSProperties = { ...inputS, opacity: 0.6, cursor: 'not-allowed' }
const sectionHeader: React.CSSProperties = { padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']

function maskCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

interface FormState {
  name: string
  tradeName: string
  phone: string
  email: string
  addressStreet: string
  addressNumber: string
  addressComplement: string
  addressNeighborhood: string
  addressCity: string
  addressState: string
  addressZip: string
}

const EMPTY_FORM: FormState = {
  name: '', tradeName: '', phone: '', email: '',
  addressStreet: '', addressNumber: '', addressComplement: '',
  addressNeighborhood: '', addressCity: '', addressState: '', addressZip: '',
}

function tenantToForm(t: MyTenant): FormState {
  return {
    name: t.name ?? '',
    tradeName: t.tradeName ?? '',
    phone: t.phone ?? '',
    email: t.email ?? '',
    addressStreet: t.addressStreet ?? '',
    addressNumber: t.addressNumber ?? '',
    addressComplement: t.addressComplement ?? '',
    addressNeighborhood: t.addressNeighborhood ?? '',
    addressCity: t.addressCity ?? '',
    addressState: t.addressState ?? '',
    addressZip: t.addressZip ? maskCEP(t.addressZip) : '',
  }
}

export default function CompanyTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [tenant, setTenant] = useState<MyTenant | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    let cancelled = false
    getMyTenant()
      .then((t) => {
        if (cancelled) return
        setTenant(t)
        setForm(tenantToForm(t))
      })
      .catch((e: any) => {
        if (cancelled) return
        showToast(e?.response?.data?.error?.message ?? 'Erro ao carregar dados', 'err')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ViaCEP autofill — dispara quando o CEP atinge 8 dígitos. Espelha
  // a lógica de SignupPage:336 (lê logradouro/bairro/localidade/uf
  // e preenche; mantém o que o usuário já digitou se a API devolver
  // string vazia em algum campo).
  async function handleCepChange(raw: string) {
    const formatted = maskCEP(raw)
    update('addressZip', formatted)
    const digits = formatted.replace(/\D/g, '')
    if (digits.length !== 8) return

    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) {
        showToast('Não foi possível buscar o CEP. Preencha manualmente.', 'err')
        return
      }
      const data = await res.json() as {
        erro?: boolean | string
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
      }
      if (data.erro === true || (typeof data.erro === 'string' && data.erro)) {
        showToast('CEP não encontrado. Preencha o endereço manualmente.', 'err')
        return
      }
      setForm((prev) => ({
        ...prev,
        addressStreet: data.logradouro || prev.addressStreet,
        addressNeighborhood: data.bairro || prev.addressNeighborhood,
        addressCity: data.localidade || prev.addressCity,
        addressState: data.uf || prev.addressState,
      }))
    } catch {
      showToast('Erro ao buscar CEP. Preencha manualmente.', 'err')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      // Strings vazias viram "não enviar" — backend ignora undefined.
      // Evita sobrescrever valor existente com "" quando o usuário
      // limpou um campo que vamos manter null no banco.
      const payload: UpdateMyTenantPayload = {}
      const fields: (keyof FormState)[] = [
        'name', 'tradeName', 'phone', 'email',
        'addressStreet', 'addressNumber', 'addressComplement',
        'addressNeighborhood', 'addressCity', 'addressState', 'addressZip',
      ]
      for (const f of fields) {
        const v = form[f].trim()
        if (v) payload[f] = v
      }

      const updated = await updateMyTenant(payload)
      setTenant(updated)
      setForm(tenantToForm(updated))
      // Outros telas (header, MySubscriptionPage etc) leem useCurrentTenant —
      // invalidar pra que o próximo mount pegue name/tradeName atualizados.
      invalidateCurrentTenantCache()
      showToast('Dados atualizados com sucesso!')
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={card}>
        <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader2 size={16} className="animate-spin" color="#f97316" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando dados da empresa...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', borderLeft: `4px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dados da Empresa</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Informações usadas em cobranças, boletos e notas fiscais.
        </p>
      </div>

      {/* Identificação */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={sectionHeader}>Identificação</div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Razão Social">
              <input value={form.name} onChange={(e) => update('name', e.target.value)} style={inputS} placeholder="Razão social registrada" />
            </Field>
            <Field label="Nome Fantasia">
              <input value={form.tradeName} onChange={(e) => update('tradeName', e.target.value)} style={inputS} placeholder="Como sua empresa é conhecida" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="CNPJ" hint="Entre em contato com o suporte para alterar">
              <input value={tenant?.cnpj ? maskCNPJ(tenant.cnpj) : '—'} disabled style={inputDisabled} />
            </Field>
            <Field label="Telefone">
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} style={inputS} placeholder="(11) 99999-9999" />
            </Field>
          </div>
          <Field label="E-mail de contato" hint="Não altera o e-mail de login">
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} style={inputS} placeholder="contato@empresa.com.br" />
          </Field>
        </div>
      </div>

      {/* Endereço */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={sectionHeader}>Endereço</div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="CEP">
              <div style={{ position: 'relative' }}>
                <input value={form.addressZip} onChange={(e) => handleCepChange(e.target.value)} style={inputS} placeholder="00000-000" maxLength={9} />
                {buscandoCep && (
                  <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    <Loader2 size={14} className="animate-spin" color="#f97316" />
                  </div>
                )}
              </div>
            </Field>
            <Field label="Logradouro">
              <input value={form.addressStreet} onChange={(e) => update('addressStreet', e.target.value)} style={inputS} placeholder="Rua, Avenida, Travessa…" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Número">
              <input value={form.addressNumber} onChange={(e) => update('addressNumber', e.target.value)} style={inputS} placeholder="123" />
            </Field>
            <Field label="Complemento" hint="opcional">
              <input value={form.addressComplement} onChange={(e) => update('addressComplement', e.target.value)} style={inputS} placeholder="Sala, andar, bloco…" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
            <Field label="Bairro">
              <input value={form.addressNeighborhood} onChange={(e) => update('addressNeighborhood', e.target.value)} style={inputS} />
            </Field>
            <Field label="Cidade">
              <input value={form.addressCity} onChange={(e) => update('addressCity', e.target.value)} style={inputS} />
            </Field>
            <Field label="UF">
              <select value={form.addressState} onChange={(e) => update('addressState', e.target.value)} style={{ ...inputS, appearance: 'none', cursor: 'pointer' }}>
                <option value="">--</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Aviso + Salvar */}
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        Preencha o endereço completo para conseguir emitir boletos e cadastrar cartão de crédito.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        <span>{label}</span>
        {hint && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}
