import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Users, BarChart2, Target, CreditCard, Pencil, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import { getTenant, updateTenant } from '../../services/admin.service'
import api from '../../services/api'

interface TenantUser { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }
interface TenantCharge { id: string; amount: number; dueDate: string; paidAt: string | null; status: string; paymentMethod: string; boletoUrl: string | null; pixCopiaECola: string | null }
interface TenantNote { id: string; content: string; author: string; createdAt: string }
interface TenantData {
  id: string; name: string; email: string; cnpj: string; phone: string | null
  status: string; trialEndsAt: string | null; planStartedAt: string | null; planExpiresAt: string | null
  internalNotes: string | null; createdAt: string
  plan: { id: string; name: string; slug: string; priceMonthly: number }
  users: TenantUser[]; charges: TenantCharge[]; notes: TenantNote[]
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

function formatCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return 'Nunca'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Nunca'
  const day = d.toLocaleDateString('pt-BR')
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day} às ${time}`
}

const thS: React.CSSProperties = { padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const btnS: React.CSSProperties = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TenantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [editModal, setEditModal] = useState(false)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

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
    showToast(newStatus === 'SUSPENDED' ? 'Cliente suspenso' : 'Cliente reativado')
  }

  async function handleAddNote() {
    if (!noteText.trim() || !id) return
    setSavingNote(true)
    try {
      const { data: res } = await api.post(`/admin/tenants/${id}/notes`, { content: noteText })
      if (res.success && data) {
        setData({ ...data, notes: [res.data, ...(data.notes ?? [])] })
        setNoteText('')
        showToast('Observação adicionada')
      }
    } catch (e: any) { showToast(e.response?.data?.error?.message ?? 'Erro ao salvar observação', 'err') }
    finally { setSavingNote(false) }
  }

  async function handleRetryCharge(chargeId: string, method: string) {
    if (!id) return
    try {
      await api.post(`/admin/charges/${chargeId}/retry`, { paymentMethod: method })
      showToast('Cobrança enviada com sucesso!')
    } catch (e: any) { showToast(e.response?.data?.error?.message ?? 'Erro ao cobrar', 'err') }
  }

  async function handleEditSave(payload: Record<string, unknown>) {
    if (!id || !data) return
    try {
      const updated = await updateTenant(id, payload)
      setData({ ...data, ...updated })
      setEditModal(false)
      showToast('Dados atualizados')
    } catch (e: any) { showToast(e.response?.data?.error?.message ?? 'Erro ao atualizar', 'err') }
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
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `4px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast.msg}</div>}

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
          <button onClick={() => setEditModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Pencil size={14} strokeWidth={1.5} /> Editar
          </button>
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
          <Field label="CNPJ" value={formatCnpj(data.cnpj)} />
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
                  <td style={tdS}>{formatDateTime(u.lastLoginAt)}</td>
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
            <thead><tr style={{ background: 'var(--bg)' }}>{['Valor', 'Vencimento', 'Pagamento', 'Método', 'Status', 'Ações'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
            <tbody>
              {data.charges.map(c => { const cs = chargeS[c.status] ?? chargeS.PENDING!; return (
                <tr key={c.id}>
                  <td style={{ ...tdS, fontWeight: 700 }}>{fmt(Number(c.amount))}</td>
                  <td style={tdS}>{new Date(c.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td style={tdS}>{c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={tdS}>{c.paymentMethod}</td>
                  <td style={tdS}><span style={{ background: cs.bg, color: cs.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{cs.label}</span></td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(c.status === 'PENDING' || c.status === 'OVERDUE') && (
                        <button onClick={() => handleRetryCharge(c.id, c.paymentMethod)} style={{ ...btnS, color: '#f97316' }}>Cobrar agora</button>
                      )}
                      {c.boletoUrl && (
                        <a href={c.boletoUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnS, color: '#3b82f6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Ver boleto</a>
                      )}
                      {c.pixCopiaECola && (
                        <button onClick={() => { navigator.clipboard.writeText(c.pixCopiaECola!); showToast('Pix copiado!') }} style={{ ...btnS, color: '#22c55e' }}>Copiar Pix</button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        ) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma cobrança</div>}
      </div>

      {/* Internal Notes */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Observações internas</div>

        {data.notes?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {data.notes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>{n.author}</strong> — {new Date(n.createdAt).toLocaleDateString('pt-BR')} às {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Nenhuma observação registrada</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <textarea rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Adicionar observação..." style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <button onClick={handleAddNote} disabled={!noteText.trim() || savingNote} style={{ background: noteText.trim() ? '#f97316' : 'var(--border)', color: noteText.trim() ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: noteText.trim() ? 'pointer' : 'not-allowed', alignSelf: 'flex-end' }}>
            {savingNote ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {editModal && <EditTenantModal data={data} onClose={() => setEditModal(false)} onSave={handleEditSave} />}
    </AppLayout>
  )
}

/* ── Edit Modal ── */
function EditTenantModal({ data, onClose, onSave }: { data: TenantData; onClose: () => void; onSave: (p: Record<string, unknown>) => void }) {
  const [name, setName] = useState(data.name)
  const [email, setEmail] = useState(data.email)
  const [phone, setPhone] = useState(data.phone ?? '')
  const [saving, setSaving] = useState(false)
  const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    setSaving(true)
    await onSave({ name, email, phone: phone || null })
    setSaving(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Editar Cliente</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome da empresa</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputS} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Telefone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" style={inputS} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim() || !email.trim() || saving} style={{ background: name.trim() && email.trim() ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() && email.trim() ? '#fff' : 'var(--text-muted)', cursor: name.trim() && email.trim() ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </>
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
