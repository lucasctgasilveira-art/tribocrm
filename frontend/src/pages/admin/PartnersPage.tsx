import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, Handshake, X, ChevronLeft, FileText, Copy, Check, ArrowUpRight } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import {
  listPartners, getPartner, createPartner, updatePartner, deletePartner,
  type PartnerListItem, type PartnerDetail, type CreatePartnerInput,
} from '../../services/partners.service'

/**
 * Gestão de parceiros pelo Super Admin.
 *
 * Fluxo:
 *   - Lista de cards: nome, código, comissão %, status, totais (pending/available/paid)
 *   - Click → detalhe com aba Indicações + Comissões
 *   - "Novo parceiro" abre modal (gera código auto, mostra ao final)
 *   - Toggle ativo/inativo via switch
 *   - Edição via modal
 *
 * Exclusão é hard-delete e só permite quando parceiro NÃO tem
 * commission registrada (regra do backend). Caso contrário, recomenda
 * desativar.
 */

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function maskDocument(doc: string | null): string {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return doc
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editingPartner, setEditingPartner] = useState<PartnerListItem | null>(null)
  const [detailView, setDetailView] = useState<string | null>(null)
  const [reportMode, setReportMode] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listPartners()
      setPartners(data)
      setError('')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao carregar parceiros')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (detailView) {
    return (
      <AppLayout menuItems={adminMenuItems}>
        <PartnerDetailView id={detailView} onBack={() => { setDetailView(null); load() }} />
      </AppLayout>
    )
  }

  if (reportMode) {
    return (
      <AppLayout menuItems={adminMenuItems}>
        <CommissionsReportView onBack={() => setReportMode(false)} />
      </AppLayout>
    )
  }

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Parceiros</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
            Agências/afiliados que indicam clientes e recebem comissão recorrente sobre os pagamentos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setReportMode(true)} style={{
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
            padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <FileText size={16} /> Relatório de comissões
          </button>
          <button onClick={() => setCreateModal(true)} style={{
            background: 'var(--accent)', border: 'none', borderRadius: 8,
            padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={16} strokeWidth={2.5} /> Novo parceiro
          </button>
        </div>
      </div>

      <div style={{ ...card, padding: 16, marginBottom: 20, display: 'flex', gap: 12 }}>
        <Handshake size={18} color="#f97316" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Cada parceiro tem um código único (ex: <code style={{ background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4 }}>PRTAB12CD34</code>) usado em links de divulgação tipo <code style={{ background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4 }}>tribocrm.com.br/?ref=CODIGO</code>. Quando alguém faz signup pelo link, vira indicação. Comissão = % aplicada a cada cobrança PAGA do cliente, com 30 dias de carência antes de virar disponível.
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
        </div>
      ) : partners.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <Handshake size={36} color="var(--text-muted)" strokeWidth={1.2} style={{ display: 'inline-block', marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>Nenhum parceiro cadastrado</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Clique em "Novo parceiro" pra começar.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {partners.map(p => (
            <PartnerCard
              key={p.id}
              partner={p}
              onView={() => setDetailView(p.id)}
              onEdit={() => setEditingPartner(p)}
              onChange={load}
            />
          ))}
        </div>
      )}

      {createModal && (
        <CreateOrEditModal
          onClose={() => setCreateModal(false)}
          onSaved={() => { setCreateModal(false); load() }}
        />
      )}

      {editingPartner && (
        <CreateOrEditModal
          editing={editingPartner}
          onClose={() => setEditingPartner(null)}
          onSaved={() => { setEditingPartner(null); load() }}
        />
      )}
    </AppLayout>
  )
}

// ─── Card ───────────────────────────────────────────────────────

function PartnerCard({ partner, onView, onEdit, onChange }: {
  partner: PartnerListItem
  onView: () => void
  onEdit: () => void
  onChange: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const referralUrl = `https://tribocrm.com.br/?ref=${partner.code}`

  function copyLink(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }).catch(() => {})
  }

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy('toggle')
    try {
      await updatePartner(partner.id, { isActive: !partner.isActive })
      onChange()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Excluir parceiro "${partner.name}"? Não pode ser desfeito.`)) return
    setBusy('delete')
    try {
      await deletePartner(partner.id)
      onChange()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Erro ao excluir')
      setBusy(null)
    }
  }

  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{partner.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              background: partner.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
              color: partner.isActive ? '#22c55e' : 'var(--text-muted)',
            }}>
              {partner.isActive ? 'ATIVO' : 'INATIVO'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{partner.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontFamily: 'monospace', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4 }}>{partner.code}</span>
            <span><strong>{Number(partner.commissionRate)}%</strong> de comissão</span>
            <span>{partner._count.referredTenants} indicação{partner._count.referredTenants !== 1 ? 'ões' : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={copyLink} title="Copiar link de divulgação" style={{
            width: 28, height: 28, padding: 0,
            background: copiedLink ? '#22c55e' : 'transparent',
            border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
            color: copiedLink ? '#fff' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {copiedLink ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button onClick={handleToggle} disabled={!!busy} title={partner.isActive ? 'Desativar' : 'Ativar'} style={{
            width: 28, height: 28, padding: 0, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          }}>
            {busy === 'toggle' ? <Loader2 size={14} className="animate-spin" /> : (partner.isActive ? '⏸' : '▶')}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit() }} disabled={!!busy} title="Editar" style={{
            width: 28, height: 28, padding: 0, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          }}>
            ✎
          </button>
          <button onClick={handleDelete} disabled={!!busy} title="Excluir" style={{
            width: 28, height: 28, padding: 0, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {busy === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <Stat label="Pendente" value={fmtBRL(partner.totals.pending)} color="#f59e0b" />
        <Stat label="Disponível" value={fmtBRL(partner.totals.available)} color="#22c55e" />
        <Stat label="Pago" value={fmtBRL(partner.totals.paid)} color="var(--text-muted)" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Cadastrado em {fmtDate(partner.createdAt)}
        </div>
        <button onClick={onView} style={{
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500,
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          Ver detalhes →
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

// ─── Modal Criar/Editar ─────────────────────────────────────────

function CreateOrEditModal({ editing, onClose, onSaved }: {
  editing?: PartnerListItem
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!editing
  const [form, setForm] = useState<CreatePartnerInput & { isActive?: boolean }>({
    name: editing?.name ?? '',
    email: editing?.email ?? '',
    document: editing?.document ?? '',
    phone: '',
    pixKey: '',
    bankInfo: '',
    commissionRate: editing ? Number(editing.commissionRate) : 20,
    notes: '',
    isActive: editing?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdCode, setCreatedCode] = useState<string | null>(null)

  // Quando editando, busca dados completos pra pré-preencher
  useEffect(() => {
    if (!editing) return
    getPartner(editing.id).then(data => {
      setForm(f => ({
        ...f,
        phone: data.phone ?? '',
        pixKey: data.pixKey ?? '',
        bankInfo: data.bankInfo ?? '',
        notes: data.notes ?? '',
      }))
    }).catch(() => {})
  }, [editing])

  function update(k: keyof typeof form, v: any) {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome obrigatório'); return }
    if (!form.email.trim() || !form.email.includes('@')) { setError('E-mail inválido'); return }
    if (form.commissionRate < 0 || form.commissionRate > 100) { setError('Comissão deve ser entre 0 e 100'); return }

    setSaving(true)
    setError('')
    try {
      if (isEdit && editing) {
        await updatePartner(editing.id, form)
        onSaved()
      } else {
        const result = await createPartner(form)
        setCreatedCode(result.code)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao salvar')
      setSaving(false)
    }
  }

  if (createdCode) {
    return (
      <ShowCodeModal code={createdCode} onClose={() => { setCreatedCode(null); onSaved() }} />
    )
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 540, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isEdit ? 'Editar parceiro' : 'Novo parceiro'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nome da agência *">
            <input value={form.name} onChange={e => update('name', e.target.value)} style={inputS} autoFocus />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="E-mail *">
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} style={inputS} />
            </Field>
            <Field label="CNPJ/CPF">
              <input value={form.document ?? ''} onChange={e => update('document', e.target.value)} placeholder="Só números" style={inputS} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Telefone">
              <input value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} style={inputS} />
            </Field>
            <Field label="Comissão % *">
              <input type="number" min={0} max={100} step={0.5} value={form.commissionRate} onChange={e => update('commissionRate', Number(e.target.value))} style={inputS} />
            </Field>
          </div>
          <Field label="Chave PIX (pra pagar comissão)">
            <input value={form.pixKey ?? ''} onChange={e => update('pixKey', e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" style={inputS} />
          </Field>
          <Field label="Outras informações bancárias">
            <textarea value={form.bankInfo ?? ''} onChange={e => update('bankInfo', e.target.value)} rows={2} placeholder="Banco, agência, conta — caso PIX não seja a opção" style={{ ...inputS, fontFamily: 'inherit', resize: 'vertical' }} />
          </Field>
          <Field label="Observações">
            <textarea value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} rows={2} style={{ ...inputS, fontFamily: 'inherit', resize: 'vertical' }} />
          </Field>
          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => update('isActive', e.target.checked)} style={{ accentColor: '#f97316' }} />
              Parceiro ativo (recebe comissões)
            </label>
          )}
          {error && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} disabled={saving} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : (isEdit ? 'Salvar' : 'Criar parceiro')}
          </button>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Modal: código gerado ───────────────────────────────────────

function ShowCodeModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = `https://tribocrm.com.br/?ref=${code}`

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 540, maxWidth: '92vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Handshake size={18} color="#f97316" /> Parceiro criado!
          </h2>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Use os dados abaixo pra orientar o parceiro a divulgar o código:
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Código</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={code} readOnly onClick={e => (e.target as HTMLInputElement).select()} style={{ ...inputS, fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }} />
              <button onClick={() => handleCopy(code)} style={{ background: copied ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Link de divulgação</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={url} readOnly onClick={e => (e.target as HTMLInputElement).select()} style={{ ...inputS, fontFamily: 'monospace', fontSize: 11 }} />
              <button onClick={() => handleCopy(url)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Copy size={13} /> Copiar
              </button>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Detalhe do parceiro ────────────────────────────────────────

function PartnerDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [partner, setPartner] = useState<PartnerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'tenants' | 'commissions'>('tenants')

  useEffect(() => {
    getPartner(id).then(setPartner).finally(() => setLoading(false))
  }, [id])

  if (loading || !partner) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
      <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
    </div>
  }

  return (
    <>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
        <ChevronLeft size={16} /> Voltar
      </button>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{partner.name}</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>📧 {partner.email}</span>
          {partner.document && <span>📄 {maskDocument(partner.document)}</span>}
          {partner.phone && <span>📞 {partner.phone}</span>}
          <span style={{ fontFamily: 'monospace', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4 }}>{partner.code}</span>
          <span><strong>{Number(partner.commissionRate)}%</strong></span>
        </div>
        {partner.pixKey && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            🏦 PIX: <code style={{ background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4 }}>{partner.pixKey}</code>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <TabButton active={tab === 'tenants'} onClick={() => setTab('tenants')}>
          Indicações ({partner.referredTenants.length})
        </TabButton>
        <TabButton active={tab === 'commissions'} onClick={() => setTab('commissions')}>
          Comissões ({partner.commissions.length})
        </TabButton>
      </div>

      {tab === 'tenants' && (
        <div style={{ ...card }}>
          {partner.referredTenants.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhuma indicação ainda.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Cliente</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>E-mail</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Indicado em</th>
                </tr>
              </thead>
              <tbody>
                {partner.referredTenants.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)', fontSize: 13 }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{t.email}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{t.status}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{fmtDate(t.referredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'commissions' && (
        <div style={{ ...card }}>
          {partner.commissions.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhuma comissão ainda. Comissões são geradas automaticamente quando uma cobrança do cliente indicado é paga.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Cliente</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Cobrança</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>%</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Comissão</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Disponível em</th>
                </tr>
              </thead>
              <tbody>
                {partner.commissions.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)', fontSize: 13 }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{c.tenant?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{fmtBRL(c.amount)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{c.rate}%</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{fmtBRL(c.commission)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <CommissionStatusBadge status={c.status} />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{fmtDate(c.availableAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      padding: '10px 16px', fontSize: 13, fontWeight: 600,
      color: active ? 'var(--accent)' : 'var(--text-muted)',
      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      marginBottom: -1,
    }}>
      {children}
    </button>
  )
}

function CommissionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PENDING: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Em carência' },
    AVAILABLE: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Disponível' },
    PAID: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Pago' },
    REVERSED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Estornado' },
  }
  const cfg = map[status] ?? { bg: 'var(--bg-surface)', color: 'var(--text-muted)', label: status }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Relatório de comissões ─────────────────────────────────────

function CommissionsReportView({ onBack }: { onBack: () => void }) {
  const today = new Date()
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { commissionsReport } = await import('../../services/partners.service')
      const result = await commissionsReport({
        month,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      setData(result)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }, [month, statusFilter])

  useEffect(() => { load() }, [load])

  function exportCSV() {
    if (!data?.groups?.length) return
    const rows: string[][] = [
      ['Parceiro', 'Código', 'CNPJ/CPF', 'Chave PIX', 'Cliente', 'Cobrança (R$)', '% Comissão', 'Comissão (R$)', 'Status', 'Disponível em', 'Pago em'],
    ]
    for (const g of data.groups) {
      for (const c of g.commissions) {
        rows.push([
          g.partner.name,
          g.partner.code,
          g.partner.document ?? '',
          g.partner.pixKey ?? '',
          c.tenant?.name ?? '',
          c.amount.toString().replace('.', ','),
          c.rate.toString().replace('.', ','),
          c.commission.toString().replace('.', ','),
          c.status,
          c.availableAt ? new Date(c.availableAt).toLocaleDateString('pt-BR') : '',
          c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '',
        ])
      }
    }
    const csv = rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comissoes-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
        <ChevronLeft size={16} /> Voltar
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Relatório de comissões</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
        Lista comissões por mês de competência (mês em que a comissão fica disponível, pós carência de 30 dias).
      </p>

      <div style={{ ...card, padding: 16, marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Field label="Mês de competência">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inputS} />
        </Field>
        <Field label="Status (opcional)">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputS}>
            <option value="">Todos</option>
            <option value="PENDING">Em carência</option>
            <option value="AVAILABLE">Disponível</option>
            <option value="PAID">Pago</option>
            <option value="REVERSED">Estornado</option>
          </select>
        </Field>
        <button onClick={exportCSV} disabled={!data?.groups?.length} style={{
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
          padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)',
          cursor: data?.groups?.length ? 'pointer' : 'not-allowed',
          opacity: data?.groups?.length ? 1 : 0.5,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <ArrowUpRight size={14} /> Exportar CSV
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
        </div>
      ) : !data || data.groups.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Nenhuma comissão pra esse mês.
        </div>
      ) : (
        <>
          <div style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Stat label="Total geral" value={fmtBRL(data.totals.totalCommission)} color="#22c55e" />
            <Stat label="Parceiros com comissão" value={String(data.totals.partnerCount)} color="#3b82f6" />
            <Stat label="Comissões no mês" value={String(data.totals.commissionCount)} color="var(--text-primary)" />
          </div>

          {data.groups.map((g: any) => (
            <div key={g.partner.id} style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{g.partner.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace' }}>{g.partner.code}</span>
                    {g.partner.document && <span>{maskDocument(g.partner.document)}</span>}
                    {g.partner.pixKey && <span>PIX: {g.partner.pixKey}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>
                  {fmtBRL(g.totalCommission)}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Cliente</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Cobrança</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>%</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Comissão</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {g.commissions.map((c: any) => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--border)', fontSize: 13 }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{c.tenant?.name ?? '—'}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{fmtBRL(c.amount)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{c.rate}%</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{fmtBRL(c.commission)}</td>
                      <td style={{ padding: '10px 16px' }}><CommissionStatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </>
  )
}
