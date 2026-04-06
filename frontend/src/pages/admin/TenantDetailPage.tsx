import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Users, BarChart2, Target, CreditCard } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import { getTenant, updateTenant } from '../../services/admin.service'

interface TenantUser { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }
interface TenantCharge { id: string; amount: number; dueDate: string; paidAt: string | null; status: string; paymentMethod: string }
interface TenantData {
  id: string; name: string; email: string; cnpj: string; phone: string | null
  status: string; trialEndsAt: string | null; planStartedAt: string | null; planExpiresAt: string | null
  internalNotes: string | null; createdAt: string
  plan: { id: string; name: string; slug: string; priceMonthly: number }
  users: TenantUser[]; charges: TenantCharge[]
  _count?: { users: number; leads: number }
}

const statusS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: 'Ativo', bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  TRIAL: { label: 'Trial', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  SUSPENDED: { label: 'Suspenso', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  CANCELLED: { label: 'Cancelado', bg: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)' },
}
const chargeS: Record<string, { label: string; bg: string; color: string }> = {
  PAID: { label: 'Pago', bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  PENDING: { label: 'Pendente', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  OVERDUE: { label: 'Vencido', bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  CANCELLED: { label: 'Cancelado', bg: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)' },
}
const roleL: Record<string, string> = { OWNER: 'Proprietário', MANAGER: 'Gestor', TEAM_LEADER: 'Líder', SELLER: 'Vendedor' }
function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

const thS: React.CSSProperties = { padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TenantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getTenant(id).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function handleStatusToggle() {
    if (!data || !id) return
    const newStatus = data.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
    await updateTenant(id, { status: newStatus })
    setData({ ...data, status: newStatus })
    setToast(newStatus === 'SUSPENDED' ? 'Cliente suspenso' : 'Cliente reativado')
    setTimeout(() => setToast(''), 3000)
  }

  async function handleAddNote() {
    if (!note.trim() || !id) return
    await updateTenant(id, { internalNotes: note })
    if (data) setData({ ...data, internalNotes: (data.internalNotes ? data.internalNotes + '\n' : '') + `[${new Date().toLocaleDateString('pt-BR')}] ${note}` })
    setNote('')
    setToast('Observação salva')
    setTimeout(() => setToast(''), 3000)
  }

  if (loading) return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 108px)', gap: 10 }}>
        <Loader2 size={24} color="var(--accent)" strokeWidth={1.5} className="animate-spin" />
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando...</span>
      </div>
    </AppLayout>
  )

  if (!data) return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Cliente não encontrado</div>
    </AppLayout>
  )

  const st = statusS[data.status] ?? statusS.ACTIVE!
  const usersCount = data._count?.users ?? data.users?.length ?? 0
  const leadsCount = data._count?.leads ?? 0
  const mrr = Number(data.plan.priceMonthly)

  return (
    <AppLayout menuItems={adminMenuItems}>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/admin/clientes')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <ArrowLeft size={14} strokeWidth={1.5} /> Voltar
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{data.name}</h1>
          <span style={{ background: st.bg, color: st.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{st.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleStatusToggle} style={{ background: data.status === 'SUSPENDED' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)', color: data.status === 'SUSPENDED' ? '#22c55e' : '#ef4444', border: `1px solid ${data.status === 'SUSPENDED' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {data.status === 'SUSPENDED' ? 'Reativar' : 'Suspender'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard icon={CreditCard} iconColor="#f97316" label="Plano atual" value={data.plan.name} />
        <KpiCard icon={Users} iconColor="#3b82f6" label="Usuários ativos" value={String(usersCount)} />
        <KpiCard icon={Target} iconColor="#22c55e" label="Total de leads" value={String(leadsCount)} />
        <KpiCard icon={BarChart2} iconColor="#f97316" label="MRR do cliente" value={fmt(mrr)} />
      </div>

      {/* Company data */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Dados da empresa</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Field label="CNPJ" value={data.cnpj} />
          <Field label="E-mail" value={data.email} />
          <Field label="Telefone" value={data.phone ?? '—'} />
          <Field label="Criado em" value={new Date(data.createdAt).toLocaleDateString('pt-BR')} />
          <Field label="Início do plano" value={data.planStartedAt ? new Date(data.planStartedAt).toLocaleDateString('pt-BR') : '—'} />
          <Field label="Expira em" value={data.planExpiresAt ? new Date(data.planExpiresAt).toLocaleDateString('pt-BR') : '—'} />
        </div>
      </div>

      {/* Users */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Usuários ({data.users?.length ?? 0})</span>
        </div>
        {data.users?.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--bg)' }}>{['Nome', 'E-mail', 'Cargo', 'Último login', 'Status'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
            <tbody>
              {data.users.map(u => (
                <tr key={u.id}>
                  <td style={tdS}>{u.name}</td>
                  <td style={tdS}>{u.email}</td>
                  <td style={tdS}>{roleL[u.role] ?? u.role}</td>
                  <td style={tdS}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('pt-BR') : 'Nunca'}</td>
                  <td style={tdS}><span style={{ background: u.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: u.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>{u.isActive ? 'Ativo' : 'Inativo'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum usuário</div>}
      </div>

      {/* Charges */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Histórico de cobranças</span>
        </div>
        {data.charges?.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--bg)' }}>{['Valor', 'Vencimento', 'Pagamento', 'Método', 'Status'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
            <tbody>
              {data.charges.map(c => { const cs = chargeS[c.status] ?? chargeS.PENDING!; return (
                <tr key={c.id}>
                  <td style={{ ...tdS, fontWeight: 700 }}>{fmt(Number(c.amount))}</td>
                  <td style={tdS}>{new Date(c.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td style={tdS}>{c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={tdS}>{c.paymentMethod}</td>
                  <td style={tdS}><span style={{ background: cs.bg, color: cs.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{cs.label}</span></td>
                </tr>
              )})}
            </tbody>
          </table>
        ) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma cobrança</div>}
      </div>

      {/* Notes */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Observações internas</div>
        {data.internalNotes ? (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 16, lineHeight: 1.6 }}>{data.internalNotes}</div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Nenhuma observação registrada</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Adicionar observação..." style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <button onClick={handleAddNote} disabled={!note.trim()} style={{ background: note.trim() ? '#f97316' : 'var(--border)', color: note.trim() ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: note.trim() ? 'pointer' : 'not-allowed', alignSelf: 'flex-end' }}>Salvar</button>
        </div>
      </div>
    </AppLayout>
  )
}

function KpiCard({ icon: Icon, iconColor, label, value }: { icon: typeof Users; iconColor: string; label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'relative' }}>
      <Icon size={18} color={iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 16, right: 16 }} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}
