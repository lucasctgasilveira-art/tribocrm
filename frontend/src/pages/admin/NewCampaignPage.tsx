import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, Info } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import api from '../../services/api'

type TenantStatus = 'ACTIVE' | 'TRIAL' | 'PAYMENT_OVERDUE' | 'SUSPENDED' | 'CANCELLED'
type Role = 'OWNER' | 'MANAGER' | 'TEAM_LEADER' | 'SELLER'
type Audience = 'OWNERS' | 'ALL_USERS'

interface CampaignFilters {
  planIds: string[]
  tenantStatuses: TenantStatus[]
  roles: Role[]
}

interface PreviewResult {
  count: number
  sample: Array<{
    userId: string
    name: string
    email: string
    role: string
    tenantId: string
    tenantName: string
    planName: string | null
  }>
}

type CampaignStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface Campaign {
  id: string
  templateId: number
  paramsJson: Record<string, unknown>
  audience: 'OWNERS' | 'ALL_USERS'
  filtersJson: unknown
  status: CampaignStatus
  totalRecipients: number
  sent: number
  failed: number
  skipped: number
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  createdBy: string | null
}

const FINAL_STATUSES: CampaignStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

interface PlanOption {
  id: string
  name: string
}

const STATUS_OPTIONS: { value: TenantStatus; label: string; color: string }[] = [
  { value: 'ACTIVE', label: 'Ativo', color: '#22c55e' },
  { value: 'TRIAL', label: 'Trial', color: '#3b82f6' },
  { value: 'PAYMENT_OVERDUE', label: 'Inadimplente', color: '#f59e0b' },
  { value: 'SUSPENDED', label: 'Suspenso', color: '#f97316' },
  { value: 'CANCELLED', label: 'Cancelado', color: 'var(--text-muted)' },
]

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'TEAM_LEADER', label: 'Team Leader' },
  { value: 'SELLER', label: 'Seller' },
]

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
}

const cardTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 14,
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  fontWeight: 600,
}

const input: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  background: '#f97316',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '12px 24px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 24px',
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

function chip(active: boolean, color = '#f97316'): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 16,
    fontSize: 13,
    cursor: 'pointer',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? `${color}1A` : 'transparent',
    color: active ? color : 'var(--text-secondary)',
    transition: 'all 0.15s',
    userSelect: 'none' as const,
  }
}

export default function NewCampaignPage() {
  const navigate = useNavigate()

  const [templateId, setTemplateId] = useState<string>('')
  const [paramsText, setParamsText] = useState<string>('{}')
  const [audience, setAudience] = useState<Audience>('OWNERS')
  const [filters, setFilters] = useState<CampaignFilters>({
    planIds: [],
    tenantStatuses: [],
    roles: [],
  })

  const [plans, setPlans] = useState<PlanOption[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)

  const [sending, setSending] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [toast, setToast] = useState<string | null>(null)

  // Carrega lista de planos no mount
  useEffect(() => {
    let cancelled = false
    api
      .get<{ success: boolean; data: PlanOption[] }>('/admin/plans')
      .then((res) => {
        if (cancelled) return
        const list = (res.data?.data ?? []) as Array<{ id: string; name: string }>
        setPlans(list.map((p) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {
        if (!cancelled) setToast('Falha ao carregar lista de planos')
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Polling do status da campanha (sub-etapa 6L.3.c).
  // Ativado quando POST /campaign/send retorna campaignId. Bate em
  // GET /admin/campaigns/:id a cada 2s até status virar terminal.
  useEffect(() => {
    if (!campaignId) return

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await api.get<{ success: boolean; data: Campaign }>(
          `/admin/campaigns/${campaignId}`,
        )
        if (cancelled) return
        const camp = res.data?.data
        if (!camp) return
        setCampaign(camp)
        if (FINAL_STATUSES.includes(camp.status)) {
          stopPolling()
        }
      } catch (err: any) {
        // Erros transitórios não param o polling — UX prefere
        // tentar de novo a deixar a tela travada.
        console.error('[polling] erro:', err?.message)
      }
    }

    void poll()
    intervalId = setInterval(poll, 2000)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [campaignId])

  // Invalida prévia ao mudar campos relevantes
  useEffect(() => {
    setPreview(null)
  }, [templateId, paramsText, audience, filters])

  function toggleStatus(s: TenantStatus) {
    setFilters((f) => ({
      ...f,
      tenantStatuses: f.tenantStatuses.includes(s)
        ? f.tenantStatuses.filter((x) => x !== s)
        : [...f.tenantStatuses, s],
    }))
  }

  function toggleRole(r: Role) {
    setFilters((f) => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r],
    }))
  }

  function togglePlan(id: string) {
    setFilters((f) => ({
      ...f,
      planIds: f.planIds.includes(id) ? f.planIds.filter((x) => x !== id) : [...f.planIds, id],
    }))
  }

  const handlePreview = useCallback(async () => {
    if (!templateId || Number(templateId) <= 0) {
      setToast('Informe um ID de template válido')
      return
    }
    try {
      JSON.parse(paramsText || '{}')
    } catch {
      setToast('JSON dos parâmetros é inválido')
      return
    }

    setPreviewing(true)
    try {
      const res = await api.post<{ success: boolean; data: PreviewResult }>(
        '/admin/campaign/preview',
        { filters, audience },
      )
      const data = res.data?.data
      if (!data) {
        setToast('Resposta inválida do servidor')
        return
      }
      setPreview(data)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Erro ao calcular prévia'
      setToast(msg)
    } finally {
      setPreviewing(false)
    }
  }, [templateId, paramsText, filters, audience])

  const handleSend = useCallback(async () => {
    if (!preview || preview.count === 0) return
    setShowConfirm(false)
    setSending(true)
    setCampaign(null)
    setCampaignId(null)

    try {
      const params = JSON.parse(paramsText || '{}')
      const res = await api.post<{
        success: boolean
        data: { campaignId: string; status: CampaignStatus; totalRecipients: number }
      }>('/admin/campaign/send', {
        filters,
        audience,
        templateId: Number(templateId),
        params,
      })
      const data = res.data?.data
      if (!data?.campaignId) {
        setToast('Resposta inválida do servidor')
        setSending(false)
        return
      }
      // Dispara o polling. sending continua true até o primeiro
      // tick popular `campaign` — a tela de progresso renderiza
      // com base em `campaign`, então `sending` sem `campaign`
      // mostra apenas o loader de transição.
      setCampaignId(data.campaignId)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Erro ao disparar campanha'
      setToast(msg)
      setSending(false)
    }
  }, [preview, paramsText, filters, audience, templateId])

  const handleCancel = useCallback(async () => {
    if (!campaignId || cancelling) return
    if (!window.confirm('Tem certeza que deseja cancelar esta campanha?')) return

    try {
      setCancelling(true)
      await api.post(`/admin/campaigns/${campaignId}/cancel`)
      // Polling vai pegar status=CANCELLED na próxima iteração.
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Erro ao cancelar'
      setToast(msg)
    } finally {
      setCancelling(false)
    }
  }, [campaignId, cancelling])

  function resetForm() {
    setTemplateId('')
    setParamsText('{}')
    setAudience('OWNERS')
    setFilters({ planIds: [], tenantStatuses: [], roles: [] })
    setPreview(null)
    setCampaign(null)
    setCampaignId(null)
    setSending(false)
    setCancelling(false)
  }

  function formatElapsed(from: string | null, to: string | null): string {
    if (!from) return '—'
    const start = new Date(from).getTime()
    const end = to ? new Date(to).getTime() : Date.now()
    const seconds = Math.max(0, Math.floor((end - start) / 1000))
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${String(s).padStart(2, '0')}s`
  }

  const canPreview = templateId.trim() !== '' && Number(templateId) > 0
  const canSend = preview !== null && preview.count > 0
  const estimatedSeconds = preview ? Math.ceil(preview.count * 0.1) : 0

  // ── Tela: campanha finalizada ────────────────────────────────
  if (campaign && FINAL_STATUSES.includes(campaign.status)) {
    const titleByStatus: Record<CampaignStatus, string> = {
      PENDING: 'Aguardando',
      RUNNING: 'Em execução',
      COMPLETED: 'Campanha concluída',
      FAILED: 'Campanha falhou',
      CANCELLED: 'Campanha cancelada',
    }
    const borderColorByStatus: Record<CampaignStatus, string> = {
      PENDING: 'var(--border)',
      RUNNING: 'var(--border)',
      COMPLETED: campaign.failed === 0 ? '#22c55e' : '#f59e0b',
      FAILED: '#ef4444',
      CANCELLED: 'var(--text-muted)',
    }

    return (
      <AppLayout menuItems={adminMenuItems}>
        <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 24 }}>
            {titleByStatus[campaign.status]}
          </h1>

          <div
            style={{
              ...card,
              borderColor: borderColorByStatus[campaign.status],
              borderWidth: 2,
              padding: 24,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Stat label="Total" value={campaign.totalRecipients} />
              <Stat label="Enviados" value={campaign.sent} color="#22c55e" />
              <Stat label="Falhas" value={campaign.failed} color="#ef4444" />
              <Stat label="Pulados" value={campaign.skipped} color="var(--text-muted)" />
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              Duração: {formatElapsed(campaign.startedAt, campaign.completedAt)}
            </div>
          </div>

          {campaign.status === 'CANCELLED' && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(107,114,128,0.08)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              Esta campanha foi cancelada antes de processar todos os destinatários.
            </div>
          )}

          {campaign.status === 'FAILED' && campaign.errorMessage && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>
                Detalhes do erro:
              </div>
              <pre
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  padding: 12,
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#fca5a5',
                  overflow: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {campaign.errorMessage}
              </pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button" onClick={() => navigate('/admin/logs/emails')} style={primaryBtn}>
              Ver logs completos
            </button>
            <button type="button" onClick={resetForm} style={secondaryBtn}>
              Nova campanha
            </button>
          </div>
        </div>
        {toastEl(toast)}
      </AppLayout>
    )
  }

  // ── Tela: campanha em andamento (PENDING / RUNNING) ──────────
  if (campaign) {
    const processed = campaign.sent + campaign.failed + campaign.skipped
    const total = Math.max(1, campaign.totalRecipients)
    const pct = Math.min(100, Math.round((processed / total) * 100))
    const titleByStatus = {
      PENDING: 'Aguardando processamento...',
      RUNNING: 'Enviando campanha...',
    } as const
    const elapsedFrom = campaign.startedAt ?? campaign.createdAt

    return (
      <AppLayout menuItems={adminMenuItems}>
        <div style={{ padding: 32, maxWidth: 600, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Loader2 size={40} className="animate-spin" style={{ color: '#f97316', marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {titleByStatus[campaign.status as 'PENDING' | 'RUNNING']}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
              Template #{campaign.templateId} · {campaign.totalRecipients}{' '}
              {campaign.totalRecipients === 1 ? 'destinatário' : 'destinatários'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Iniciada há {formatElapsed(elapsedFrom, null)}
            </p>
          </div>

          <div
            style={{
              background: 'var(--bg)',
              borderRadius: 6,
              height: 12,
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: '#f97316',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            {processed}/{campaign.totalRecipients} processados ({pct}%) · Enviados {campaign.sent} ·
            Falhas {campaign.failed} · Pulados {campaign.skipped}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                ...secondaryBtn,
                borderColor: '#ef4444',
                color: '#ef4444',
                opacity: cancelling ? 0.5 : 1,
                cursor: cancelling ? 'not-allowed' : 'pointer',
              }}
            >
              {cancelling ? 'Cancelando...' : 'Cancelar campanha'}
            </button>
          </div>

          <div
            style={{
              padding: 12,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8,
              fontSize: 13,
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={16} />
            Você pode fechar esta aba — a campanha continua processando no servidor.
          </div>
        </div>
        {toastEl(toast)}
      </AppLayout>
    )
  }

  // ── Tela: loader inicial entre o POST e o primeiro polling ───
  if (sending) {
    return (
      <AppLayout menuItems={adminMenuItems}>
        <div style={{ padding: 32, maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#f97316', marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Agendando campanha...
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 12 }}>
            Buscando status no servidor...
          </p>
        </div>
        {toastEl(toast)}
      </AppLayout>
    )
  }

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Nova Campanha de E-mail
          </h1>
          <p style={{ margin: 0, marginTop: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
            Dispare um email em massa usando um template Brevo pra tenants/usuários selecionados.
          </p>
        </div>

        {/* Aviso */}
        <div
          style={{
            ...card,
            borderColor: 'rgba(245,158,11,0.4)',
            background: 'rgba(245,158,11,0.06)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <Info size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Crie o template na Brevo primeiro. Você vai precisar do ID do template pra disparar.
          </div>
        </div>

        {/* Seção 1 — Template */}
        <div style={card}>
          <div style={cardTitle}>Template Brevo</div>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>ID do template Brevo</label>
            <input
              type="number"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="ex: 8"
              style={input}
              min={1}
            />
          </div>
          <div>
            <label style={label}>Parâmetros do template (JSON)</label>
            <textarea
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              placeholder='{"nome": "Cliente", "cta": "https://..."}'
              style={{
                ...input,
                height: 120,
                fontFamily: 'monospace',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Variáveis como <code>{'{{params.nome}}'}</code> são substituídas no template Brevo.
            </div>
          </div>
        </div>

        {/* Seção 2 — Audiência */}
        <div style={card}>
          <div style={cardTitle}>Audiência</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="audience"
                checked={audience === 'OWNERS'}
                onChange={() => setAudience('OWNERS')}
              />
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                Apenas owner de cada empresa
              </span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="audience"
                checked={audience === 'ALL_USERS'}
                onChange={() => setAudience('ALL_USERS')}
              />
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                Todos os usuários ativos
              </span>
            </label>
          </div>
        </div>

        {/* Seção 3 — Filtros */}
        <div style={card}>
          <div style={cardTitle}>Filtros (opcionais)</div>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Plano</label>
            {plansLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando planos...</div>
            ) : plans.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhum plano disponível</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {plans.map((p) => (
                  <span
                    key={p.id}
                    onClick={() => togglePlan(p.id)}
                    style={chip(filters.planIds.includes(p.id))}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Status do tenant</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STATUS_OPTIONS.map((s) => (
                <span
                  key={s.value}
                  onClick={() => toggleStatus(s.value)}
                  style={chip(filters.tenantStatuses.includes(s.value), s.color)}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {audience === 'ALL_USERS' && (
            <div>
              <label style={label}>Role do usuário</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ROLE_OPTIONS.map((r) => (
                  <span
                    key={r.value}
                    onClick={() => toggleRole(r.value)}
                    style={chip(filters.roles.includes(r.value))}
                  >
                    {r.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Seção 4 — Ações */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button
            type="button"
            onClick={handlePreview}
            disabled={!canPreview || previewing}
            style={{
              ...secondaryBtn,
              opacity: !canPreview || previewing ? 0.5 : 1,
              cursor: !canPreview || previewing ? 'not-allowed' : 'pointer',
            }}
          >
            {previewing && <Loader2 size={14} className="animate-spin" />}
            {previewing ? 'Calculando...' : 'Calcular prévia'}
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!canSend}
            style={{
              ...primaryBtn,
              opacity: canSend ? 1 : 0.5,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            Disparar campanha
          </button>
        </div>

        {/* Seção 5 — Prévia */}
        {preview && (
          <div
            style={{
              ...card,
              borderColor: '#f97316',
              borderWidth: 2,
            }}
          >
            <div style={cardTitle}>
              Prévia — {preview.count} {preview.count === 1 ? 'destinatário' : 'destinatários'}
            </div>
            {preview.count === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Nenhum destinatário com esses filtros.
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={previewTh}>Nome</th>
                      <th style={previewTh}>Email</th>
                      <th style={previewTh}>Role</th>
                      <th style={previewTh}>Tenant</th>
                      <th style={previewTh}>Plano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((s) => (
                      <tr key={s.userId}>
                        <td style={previewTd}>{s.name}</td>
                        <td style={previewTd}>{s.email}</td>
                        <td style={previewTd}>{s.role}</td>
                        <td style={previewTd}>{s.tenantName}</td>
                        <td style={previewTd}>{s.planName ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                  Mostrando {preview.sample.length} de {preview.count} destinatários
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {showConfirm && preview && (
        <ConfirmModal
          count={preview.count}
          templateId={Number(templateId)}
          estimatedSeconds={estimatedSeconds}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleSend}
        />
      )}

      {toastEl(toast)}
    </AppLayout>
  )
}

function ConfirmModal({
  count,
  templateId,
  estimatedSeconds,
  onCancel,
  onConfirm,
}: {
  count: number
  templateId: number
  estimatedSeconds: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: 500,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          zIndex: 1001,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 16 }}>
          Confirmar envio
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, marginBottom: 8 }}>
          Você está prestes a enviar para <strong>{count}</strong>{' '}
          {count === 1 ? 'destinatário' : 'destinatários'}.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, marginBottom: 4 }}>
          Template: <strong>#{templateId}</strong>
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, marginBottom: 16 }}>
          Tempo estimado: ~{estimatedSeconds}s
        </p>
        <div
          style={{
            padding: 12,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 6,
            fontSize: 13,
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 20,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Isso não pode ser desfeito. Certifique-se do template e dos filtros.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onCancel} style={secondaryBtn}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ ...primaryBtn, background: '#ef4444' }}
          >
            Sim, enviar agora
          </button>
        </div>
      </div>
    </>
  )
}

function Stat({ label: lbl, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
        {lbl}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? 'var(--text-primary)', marginTop: 6 }}>
        {value}
      </div>
    </div>
  )
}

function toastEl(msg: string | null) {
  if (!msg) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        padding: '12px 20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: '4px solid #f97316',
        borderRadius: 8,
        fontSize: 13,
        color: 'var(--text-primary)',
        zIndex: 1100,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        maxWidth: 360,
      }}
    >
      {msg}
    </div>
  )
}

const previewTh: React.CSSProperties = {
  padding: 8,
  textAlign: 'left',
  fontSize: 11,
  color: 'var(--text-muted)',
  fontWeight: 600,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
}

const previewTd: React.CSSProperties = {
  padding: 8,
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
}
