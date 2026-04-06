import { useState } from 'react'
import { MoreHorizontal, Plus, X, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import api from '../../services/api'

interface Plan {
  name: string
  color: string
  bg: string
  active: boolean
  popular?: boolean
  price: string
  cycle: string
  limits: string[]
  customers: string
  highlight?: boolean
}

const plans: Plan[] = [
  {
    name: 'Gratuito',
    color: 'var(--text-muted)',
    bg: 'rgba(107,114,128,0.12)',
    active: true,
    price: 'R$ 0',
    cycle: '30 dias',
    limits: ['1 usuário', '50 leads', '1 pipeline'],
    customers: '28 em trial',
  },
  {
    name: 'Solo',
    color: 'var(--text-muted)',
    bg: 'rgba(107,114,128,0.12)',
    active: true,
    price: 'R$ 69',
    cycle: '/mês',
    limits: ['1 usuário', '1.000 leads', '1 pipeline', '3 modelos WPP'],
    customers: '18 ativos',
  },
  {
    name: 'Essencial',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    active: true,
    price: 'R$ 197',
    cycle: '/mês',
    limits: ['3 usuários', '5.000 leads', '3 pipelines'],
    customers: '54 ativos',
  },
  {
    name: 'Pro',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    active: true,
    popular: true,
    price: 'R$ 349',
    cycle: '/mês',
    limits: ['5 usuários', '10.000 leads', '10 pipelines', '10 automações'],
    customers: '52 ativos',
    highlight: true,
  },
  {
    name: 'Enterprise',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.12)',
    active: true,
    price: 'R$ 649',
    cycle: '/mês',
    limits: ['10 usuários', '50.000 leads', 'ilimitado pipelines', 'automações ilimitadas'],
    customers: '18 ativos',
  },
]

const stats = [
  { label: 'Total', value: '5' },
  { label: 'Ativos', value: '4' },
  { label: 'MRR médio', value: 'R$ 296' },
  { label: 'Clientes ativos', value: '142' },
]

export default function PlansPage() {
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [limitsPlan, setLimitsPlan] = useState<Plan | null>(null)
  const [toast, setToast] = useState('')

  return (
    <AppLayout menuItems={adminMenuItems}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Planos</h1>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#f97316',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 8,
            padding: '8px 16px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Novo Plano
        </button>
      </div>

      {/* stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 20px',
              flex: 1,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              {s.label}
            </span>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {plans.map((p) => (
          <div
            key={p.name}
            style={{
              background: 'var(--bg-card)',
              border: p.highlight ? '2px solid #f97316' : '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              position: 'relative',
            }}
          >
            {/* badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: p.color,
                  background: p.bg,
                  borderRadius: 6,
                  padding: '3px 10px',
                }}
              >
                {p.name}
              </span>
              {p.active && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#22c55e',
                    background: 'rgba(34,197,94,0.12)',
                    borderRadius: 6,
                    padding: '3px 8px',
                  }}
                >
                  Ativo
                </span>
              )}
              {p.popular && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#f97316',
                    background: 'rgba(249,115,22,0.12)',
                    borderRadius: 6,
                    padding: '2px 8px',
                  }}
                >
                  Mais popular
                </span>
              )}
            </div>

            {/* price */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{p.price}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>{p.cycle}</span>
            </div>

            {/* limits */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {p.limits.map((l) => (
                <span
                  key={l}
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {l}
                </span>
              ))}
            </div>

            {/* customers */}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>{p.customers}</p>

            {/* actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setEditPlan(p)} style={{ fontSize: 12, fontWeight: 500, color: '#f97316', background: 'rgba(249,115,22,0.12)', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                Editar preço
              </button>
              <button onClick={() => setLimitsPlan(p)} style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', background: 'var(--border)', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                Editar limites
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(menuOpen === p.name ? null : p.name)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <MoreHorizontal size={16} color="var(--text-muted)" />
                </button>
                {menuOpen === p.name && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 4,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 4,
                      minWidth: 140,
                      zIndex: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    {['Editar plano', 'Duplicar', 'Desativar'].map((action) => (
                      <button
                        key={action}
                        onClick={() => setMenuOpen(null)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          padding: '8px 12px',
                          fontSize: 13,
                          color: action === 'Desativar' ? '#ef4444' : 'var(--text-primary)',
                          cursor: 'pointer',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast}</div>}
      {editPlan && <EditPriceModal plan={editPlan} onClose={() => setEditPlan(null)} onSaved={() => { setEditPlan(null); setToast('Preço atualizado com sucesso!'); setTimeout(() => setToast(''), 4000) }} />}
      {limitsPlan && <EditLimitsModal plan={limitsPlan} onClose={() => setLimitsPlan(null)} onSaved={() => { setLimitsPlan(null); setToast('Limites atualizados!'); setTimeout(() => setToast(''), 4000) }} />}
    </AppLayout>
  )
}

// ── Edit Price Modal ──

function EditPriceModal({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: () => void }) {
  const currentMonthly = parseInt(plan.price.replace(/\D/g, ''))
  const [monthly, setMonthly] = useState(String(currentMonthly))
  const [yearly, setYearly] = useState(String(Math.round(currentMonthly * 12 * 0.85)))
  const [applyMode, setApplyMode] = useState<'NEW_ONLY' | 'NEW_AND_RENEWALS'>('NEW_ONLY')
  const [validFrom, setValidFrom] = useState('')
  const [saving, setSaving] = useState(false)

  const monthlyNum = parseFloat(monthly) || 0
  const yearlyNum = parseFloat(yearly) || 0
  const yearlyPerMonth = yearlyNum > 0 ? Math.round(yearlyNum / 12) : 0
  const savings = (monthlyNum * 12) - yearlyNum

  function handleMonthlyChange(v: string) {
    setMonthly(v)
    const n = parseFloat(v) || 0
    setYearly(String(Math.round(n * 12 * 0.85)))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch(`/admin/plans/${plan.name.toLowerCase()}/price`, { priceMonthly: monthlyNum, priceYearly: yearlyNum })
      onSaved()
    } catch { setSaving(false) }
  }

  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Editar preço — {plan.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Valor mensal (R$)</label>
              <input type="number" value={monthly} onChange={e => handleMonthlyChange(e.target.value)} style={inputS} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Valor anual (R$)</label>
              <input type="number" value={yearly} onChange={e => setYearly(e.target.value)} style={inputS} />
            </div>
          </div>

          {savings > 0 && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 12, color: '#22c55e', textAlign: 'center' }}>
              Anual: R$ {yearlyPerMonth}/mês — Economia de R$ {savings}/ano
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quando aplicar este preço?</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label onClick={() => setApplyMode('NEW_ONLY')} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 8, border: `1px solid ${applyMode === 'NEW_ONLY' ? 'var(--accent)' : 'var(--border)'}`, background: applyMode === 'NEW_ONLY' ? 'rgba(249,115,22,0.06)' : 'transparent', cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${applyMode === 'NEW_ONLY' ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {applyMode === 'NEW_ONLY' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Apenas novas contratações</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Contratos existentes não serão afetados</div>
              </div>
            </label>

            <label onClick={() => setApplyMode('NEW_AND_RENEWALS')} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 8, border: `1px solid ${applyMode === 'NEW_AND_RENEWALS' ? 'var(--accent)' : 'var(--border)'}`, background: applyMode === 'NEW_AND_RENEWALS' ? 'rgba(249,115,22,0.06)' : 'transparent', cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${applyMode === 'NEW_AND_RENEWALS' ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {applyMode === 'NEW_AND_RENEWALS' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Novas contratacoes e renovações</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Clientes existentes terão o novo valor na renovação</div>
              </div>
            </label>
          </div>

          {applyMode === 'NEW_AND_RENEWALS' && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Valido a partir de:</label>
              <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} style={inputS} />
              {validFrom && <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: 10, marginTop: 8, fontSize: 12, color: '#f59e0b' }}>Clientes que renovarem após {new Date(validFrom).toLocaleDateString('pt-BR')} pagarão R$ {monthlyNum}/mês</div>}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !monthlyNum} style={{ background: monthlyNum ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: monthlyNum ? '#fff' : 'var(--text-muted)', cursor: monthlyNum ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar alteração'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Edit Limits Modal ──

function EditLimitsModal({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: () => void }) {
  // Parse current limits from plan.limits array
  const parseLimitNum = (text: string) => { const m = text.match(/[\d.]+/); return m ? parseInt(m[0].replace('.', '')) : 0 }
  const limitsArr = plan.limits ?? []
  const [maxUsers, setMaxUsers] = useState(String(parseLimitNum(limitsArr[0] ?? '1')))
  const [maxLeads, setMaxLeads] = useState(String(parseLimitNum(limitsArr[1] ?? '1000')))
  const [maxPipelines, setMaxPipelines] = useState(String(parseLimitNum(limitsArr[2] ?? '1')))
  const [maxAutomations, setMaxAutomations] = useState('10')
  const [maxForms, setMaxForms] = useState('10')
  const [maxWhatsapp, setMaxWhatsapp] = useState('10')
  const [maxEmail, setMaxEmail] = useState('10')
  const [saving, setSaving] = useState(false)
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch(`/admin/plans/${plan.name.toLowerCase()}/price`, {
        maxUsers: parseInt(maxUsers), maxLeads: parseInt(maxLeads), maxPipelines: parseInt(maxPipelines),
        maxAutomations: parseInt(maxAutomations), maxForms: parseInt(maxForms),
        maxWhatsappTemplates: parseInt(maxWhatsapp), maxEmailTemplates: parseInt(maxEmail),
      })
      onSaved()
    } catch { setSaving(false) }
  }

  function Row({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
        <input type="number" value={value} onChange={e => onChange(e.target.value)} style={{ ...inputS, width: 80 }} />
      </div>
    )
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Limites — {plan.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <Row label="Usuários máximos" value={maxUsers} onChange={setMaxUsers} />
          <Row label="Leads ativos máximos" value={maxLeads} onChange={setMaxLeads} />
          <Row label="Pipelines máximos" value={maxPipelines} onChange={setMaxPipelines} />
          <Row label="Automações máximas" value={maxAutomations} onChange={setMaxAutomations} />
          <Row label="Formulários máximos" value={maxForms} onChange={setMaxForms} />
          <Row label="Modelos de WhatsApp" value={maxWhatsapp} onChange={setMaxWhatsapp} />
          <Row label="Modelos de e-mail" value={maxEmail} onChange={setMaxEmail} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Salvando...' : 'Salvar limites'}
          </button>
        </div>
      </div>
    </>
  )
}
