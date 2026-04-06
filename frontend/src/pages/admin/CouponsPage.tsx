import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import api from '../../services/api'

interface Coupon {
  id: string; code: string; description: string | null; discountType: string; discountValue: number
  applicablePlans: string[]; maxUses: number | null; maxUsesPerUser: number; usedCount: number
  validFrom: string; validUntil: string | null; durationType: string; durationMonths: number | null
  isActive: boolean; createdAt: string
}

const thS: React.CSSProperties = { padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }

function durLabel(t: string, m: number | null) { if (t === 'FIRST') return '1ª cobrança'; if (t === 'MONTHS') return `${m ?? 0} meses`; return 'Recorrente' }

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get('/admin/coupons'); setCoupons(r.data.data) } catch { setCoupons([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3000) }

  async function toggle(c: Coupon) {
    await api.patch(`/admin/coupons/${c.id}`, { isActive: !c.isActive })
    showToast(c.isActive ? 'Cupom desativado' : 'Cupom ativado')
    load()
  }

  const active = coupons.filter(c => c.isActive).length
  const usesThisMonth = coupons.reduce((s, c) => s + c.usedCount, 0)

  return (
    <AppLayout menuItems={adminMenuItems}>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cupons de Desconto</h1>
        <button onClick={() => { setEditCoupon(null); setModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Novo Cupom</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Cupons ativos', value: String(active), color: '#22c55e' },
          { label: 'Usos total', value: String(usesThisMonth), color: '#f97316' },
          { label: 'Total cupons', value: String(coupons.length), color: 'var(--text-primary)' },
          { label: 'Inativos', value: String(coupons.length - active), color: 'var(--text-muted)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{k.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando cupons...</span>
        </div>
      ) : coupons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhum cupom criado</div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--bg)' }}>
              {['Código', 'Desconto', 'Planos', 'Usos', 'Validade', 'Aplicação', 'Status', 'Ações'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr></thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id}>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontWeight: 700 }}>{c.code}</td>
                  <td style={tdS}>{c.discountType === 'PERCENT' ? `${c.discountValue}%` : `R$ ${c.discountValue}`}</td>
                  <td style={tdS}>{c.applicablePlans.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Todos</span> : c.applicablePlans.map(p => <span key={p} style={{ background: 'var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: 10, marginRight: 4, color: 'var(--text-secondary)' }}>{p}</span>)}</td>
                  <td style={tdS}>{c.usedCount}/{c.maxUses ?? '∞'}</td>
                  <td style={tdS}>{c.validUntil ? new Date(c.validUntil).toLocaleDateString('pt-BR') : 'Sem limite'}</td>
                  <td style={tdS}>{durLabel(c.durationType, c.durationMonths)}</td>
                  <td style={tdS}><span style={{ background: c.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: c.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{c.isActive ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditCoupon(c); setModal(true) }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => toggle(c)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: c.isActive ? '#ef4444' : '#22c55e', cursor: 'pointer' }}>{c.isActive ? 'Desativar' : 'Ativar'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <CouponModal coupon={editCoupon} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); showToast(editCoupon ? 'Cupom atualizado!' : 'Cupom criado!') }} />}
    </AppLayout>
  )
}

// ── Coupon Modal ──

function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(coupon?.code ?? '')
  const [description, setDescription] = useState(coupon?.description ?? '')
  const [discountType, setDiscountType] = useState(coupon?.discountType ?? 'PERCENT')
  const [discountValue, setDiscountValue] = useState(String(coupon?.discountValue ?? ''))
  const [allPlans, setAllPlans] = useState(coupon ? coupon.applicablePlans.length === 0 : true)
  const [selectedPlans, setSelectedPlans] = useState<string[]>(coupon?.applicablePlans ?? [])
  const [maxUses, setMaxUses] = useState(coupon?.maxUses != null ? String(coupon.maxUses) : '')
  const [maxUsesPerUser, setMaxUsesPerUser] = useState(String(coupon?.maxUsesPerUser ?? 1))
  const [validFrom, setValidFrom] = useState(coupon ? coupon.validFrom.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState(coupon?.validUntil?.slice(0, 10) ?? '')
  const [durationType, setDurationType] = useState(coupon?.durationType ?? 'FIRST')
  const [durationMonths, setDurationMonths] = useState(String(coupon?.durationMonths ?? 3))
  const [saving, setSaving] = useState(false)
  const iS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const canSave = code.trim() && discountValue

  function genCode() { setCode(Array.from({ length: 8 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('')) }
  function togglePlan(slug: string) { setSelectedPlans(p => p.includes(slug) ? p.filter(s => s !== slug) : [...p, slug]) }

  async function handleSave() {
    if (!canSave) return; setSaving(true)
    try {
      const body = { code: code.toUpperCase(), description: description || null, discountType, discountValue: parseFloat(discountValue), applicablePlans: allPlans ? [] : selectedPlans, maxUses: maxUses ? parseInt(maxUses) : null, maxUsesPerUser: parseInt(maxUsesPerUser) || 1, validFrom, validUntil: validUntil || null, durationType, durationMonths: durationType === 'MONTHS' ? parseInt(durationMonths) : null }
      if (coupon) await api.patch(`/admin/coupons/${coupon.id}`, body)
      else await api.post('/admin/coupons', body)
      onSaved()
    } catch { setSaving(false) }
  }

  function Lbl({ children }: { children: string }) { return <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{children}</label> }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{coupon ? 'Editar Cupom' : 'Novo Cupom'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Code */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1 }}><Lbl>Código do cupom *</Lbl><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="EX: TRIBO20" style={{ ...iS, fontFamily: 'monospace', textTransform: 'uppercase' }} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={genCode} style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Gerar aleatório</button></div>
          </div>
          {/* Description */}
          <div style={{ marginBottom: 16 }}><Lbl>Descrição (uso interno)</Lbl><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Campanha Black Friday" style={iS} /></div>
          {/* Discount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><Lbl>Tipo de desconto</Lbl>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ k: 'PERCENT', l: 'Percentual (%)' }, { k: 'FIXED', l: 'Valor fixo (R$)' }].map(t => (
                  <label key={t.k} onClick={() => setDiscountType(t.k)} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${discountType === t.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{discountType === t.k && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />}</div>{t.l}
                  </label>
                ))}
              </div>
            </div>
            <div><Lbl>Valor do desconto *</Lbl><input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'PERCENT' ? 'Ex: 20' : 'Ex: 50'} style={iS} /></div>
          </div>
          {/* Plans */}
          <div style={{ marginBottom: 16 }}>
            <Lbl>Planos válidos</Lbl>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}><input type="checkbox" checked={allPlans} onChange={() => setAllPlans(!allPlans)} style={{ accentColor: '#f97316' }} /> Todos</label>
              {!allPlans && ['solo', 'essencial', 'pro', 'enterprise'].map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}><input type="checkbox" checked={selectedPlans.includes(p)} onChange={() => togglePlan(p)} style={{ accentColor: '#f97316' }} /> {p.charAt(0).toUpperCase() + p.slice(1)}</label>
              ))}
            </div>
          </div>
          {/* Limits */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><Lbl>Limite de usos total</Lbl><input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Ilimitado" style={iS} /></div>
            <div><Lbl>Usos por usuário</Lbl><input type="number" value={maxUsesPerUser} onChange={e => setMaxUsesPerUser(e.target.value)} style={iS} /></div>
          </div>
          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><Lbl>Data início</Lbl><input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} style={iS} /></div>
            <div><Lbl>Data de validade</Lbl><input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={iS} /></div>
          </div>
          {/* Duration */}
          <div>
            <Lbl>Aplicação do desconto</Lbl>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[{ k: 'FIRST', l: 'Apenas na primeira cobrança' }, { k: 'MONTHS', l: 'Por N cobranças' }, { k: 'FOREVER', l: 'Recorrente (todas as cobranças)' }].map(d => (
                <label key={d.k} onClick={() => setDurationType(d.k)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${durationType === d.k ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{durationType === d.k && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}</div>
                  {d.l}
                  {d.k === 'MONTHS' && durationType === 'MONTHS' && <input type="number" value={durationMonths} onChange={e => setDurationMonths(e.target.value)} style={{ ...iS, width: 60, marginLeft: 8, textAlign: 'center' }} />}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave || saving} style={{ background: canSave ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Salvando...' : coupon ? 'Salvar' : 'Criar cupom'}
          </button>
        </div>
      </div>
    </>
  )
}
