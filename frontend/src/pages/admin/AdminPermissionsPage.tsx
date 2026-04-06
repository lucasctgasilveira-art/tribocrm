import { useState, useEffect, useCallback } from 'react'
import { Save } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'
import api from '../../services/api'

/* ── Permission keys & groups ── */

const PERM_GROUPS = [
  { label: 'Dashboard', keys: [
    { key: 'dashboard_view', label: 'Ver dashboard' },
    { key: 'dashboard_mrr', label: 'Ver MRR/ARR' },
  ]},
  { label: 'Clientes', keys: [
    { key: 'clients_view', label: 'Ver clientes' },
    { key: 'clients_create', label: 'Criar cliente' },
    { key: 'clients_edit', label: 'Editar cliente' },
    { key: 'clients_suspend', label: 'Suspender cliente' },
    { key: 'clients_extend', label: 'Estender gratuidade' },
    { key: 'clients_charges', label: 'Ver cobranças' },
    { key: 'clients_discount', label: 'Aplicar desconto' },
    { key: 'clients_observation', label: 'Registrar observação' },
    { key: 'clients_resetpassword', label: 'Resetar senha' },
    { key: 'clients_viewpanel', label: 'Visualizar painel' },
  ]},
  { label: 'Financeiro', keys: [
    { key: 'financial_view', label: 'Ver financeiro' },
    { key: 'financial_charge', label: 'Cobrar agora' },
    { key: 'financial_markpaid', label: 'Marcar como pago' },
    { key: 'financial_export', label: 'Exportar' },
    { key: 'financial_metrics', label: 'Ver MRR/ARR/Churn' },
  ]},
  { label: 'Cupons', keys: [
    { key: 'coupons_view', label: 'Ver cupons' },
    { key: 'coupons_create', label: 'Criar cupom' },
    { key: 'coupons_edit', label: 'Editar cupom' },
    { key: 'coupons_deactivate', label: 'Desativar cupom' },
  ]},
  { label: 'Planos', keys: [
    { key: 'plans_view', label: 'Ver planos' },
    { key: 'plans_editprice', label: 'Editar preço' },
    { key: 'plans_editlimits', label: 'Editar limites' },
  ]},
  { label: 'Pop-ups', keys: [
    { key: 'popups_view', label: 'Ver pop-ups' },
    { key: 'popups_manage', label: 'Criar/Editar/Ativar' },
  ]},
  { label: 'Equipe Interna', keys: [
    { key: 'team_view', label: 'Ver equipe' },
    { key: 'team_create', label: 'Criar membro' },
    { key: 'team_edit', label: 'Editar membro' },
    { key: 'team_permissions', label: 'Gerenciar permissões' },
  ]},
  { label: 'Logs', keys: [
    { key: 'logs_view', label: 'Ver logs' },
    { key: 'logs_export', label: 'Exportar logs' },
  ]},
  { label: 'Configurações', keys: [
    { key: 'config_view', label: 'Ver configurações' },
    { key: 'config_smtp', label: 'SMTP' },
    { key: 'config_templates', label: 'Templates' },
    { key: 'config_security', label: 'Segurança' },
  ]},
]

const ALL_KEYS = PERM_GROUPS.flatMap(g => g.keys.map(k => k.key))

/* ── Role defaults ── */

const ROLE_DEFAULTS: Record<string, Set<string>> = {
  SUPER_ADMIN: new Set(ALL_KEYS),
  FINANCIAL: new Set([
    'dashboard_view', 'dashboard_mrr',
    'clients_view', 'clients_suspend', 'clients_charges', 'clients_discount', 'clients_observation',
    'financial_view', 'financial_charge', 'financial_markpaid', 'financial_export', 'financial_metrics',
    'coupons_view', 'coupons_create', 'coupons_edit', 'coupons_deactivate',
    'plans_view', 'plans_editprice',
    'logs_view', 'logs_export',
  ]),
  SUPPORT: new Set([
    'dashboard_view',
    'clients_view', 'clients_observation', 'clients_resetpassword', 'clients_viewpanel',
    'logs_view', 'logs_export',
  ]),
  COMMERCIAL: new Set([
    'dashboard_view', 'dashboard_mrr',
    'clients_view', 'clients_create', 'clients_edit', 'clients_extend', 'clients_discount', 'clients_observation', 'clients_viewpanel',
    'financial_metrics',
    'coupons_view', 'coupons_create', 'coupons_edit',
    'plans_view',
    'popups_view', 'popups_manage',
  ]),
}

const ROLE_LABELS: Record<string, string> = { SUPER_ADMIN: 'Super Admin', FINANCIAL: 'Financeiro', SUPPORT: 'Suporte', COMMERCIAL: 'Comercial' }
const ROLE_COLORS: Record<string, string> = { SUPER_ADMIN: '#f97316', FINANCIAL: '#3b82f6', SUPPORT: '#22c55e', COMMERCIAL: '#a855f7' }

/* ── Types ── */

interface TeamMember {
  id: string; name: string; email: string; role: string; isActive: boolean
}

// customPerms: only stores overrides from the role default. null = no overrides.
type MemberPerms = Record<string, boolean>

export default function AdminPermissionsPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [customPerms, setCustomPerms] = useState<Record<string, MemberPerms | null>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/team')
        if (!data.success) return
        const teamMembers: TeamMember[] = data.data
        setMembers(teamMembers)
        // Fetch permissions for all members
        const permsMap: Record<string, MemberPerms | null> = {}
        await Promise.all(teamMembers.map(async m => {
          try {
            const { data: pd } = await api.get(`/admin/team/${m.id}/permissions`)
            permsMap[m.id] = pd.data.permissions ?? null
          } catch { permsMap[m.id] = null }
        }))
        setCustomPerms(permsMap)
      } catch { showToast('Erro ao carregar equipe', 'err') }
      finally { setLoading(false) }
    })()
  }, [showToast])

  function isOn(member: TeamMember, key: string): boolean {
    const custom = customPerms[member.id]
    if (custom && key in custom) return custom[key]!
    const defaults = ROLE_DEFAULTS[member.role]
    return defaults ? defaults.has(key) : false
  }

  function isCustom(member: TeamMember, key: string): boolean {
    const custom = customPerms[member.id]
    return custom != null && key in custom
  }

  function togglePerm(member: TeamMember, key: string) {
    if (!member.isActive) return
    const currentlyOn = isOn(member, key)
    const defaults = ROLE_DEFAULTS[member.role]
    const isDefault = defaults ? defaults.has(key) : false
    const newValue = !currentlyOn

    setCustomPerms(prev => {
      const existing = prev[member.id] ?? {}
      const updated = { ...existing }

      // If toggling back to default, remove the override
      if ((isDefault && newValue) || (!isDefault && !newValue)) {
        delete updated[key]
      } else {
        updated[key] = newValue
      }

      return { ...prev, [member.id]: Object.keys(updated).length > 0 ? updated : null }
    })
    setDirty(prev => new Set(prev).add(member.id))
  }

  async function handleSave() {
    if (dirty.size === 0) return
    setSaving(true)
    try {
      await Promise.all([...dirty].map(async id => {
        await api.patch(`/admin/team/${id}/permissions`, { permissions: customPerms[id] ?? null })
      }))
      setDirty(new Set())
      showToast('Permissões salvas com sucesso!')
    } catch (e: any) {
      showToast(e.response?.data?.error?.message ?? 'Erro ao salvar permissões', 'err')
    } finally { setSaving(false) }
  }

  function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') }

  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Permissões</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Configure as permissões individuais de cada membro da equipe</p>
        </div>
        {dirty.size > 0 && (
          <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Save size={14} strokeWidth={2} /> {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        )}
      </div>

      {/* Info card */}
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#3b82f6', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>i</span>
        <span>Permissões em <strong style={{ color: '#f97316' }}>laranja</strong> são padrão do perfil. Permissões em <strong style={{ color: '#a855f7' }}>roxo</strong> foram customizadas individualmente.</span>
      </div>

      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `4px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60 }}>{toast.msg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ width: 220, padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 2 }}>Permissão</th>
                {members.map(m => (
                  <th key={m.id} style={{ padding: '12px 16px', textAlign: 'center', minWidth: 100 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: m.isActive ? 1 : 0.4 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${ROLE_COLORS[m.role] ?? '#6b7280'}20`, color: ROLE_COLORS[m.role] ?? '#6b7280', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(m.name)}</div>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{m.name.split(' ')[0]}</span>
                      <span style={{ fontSize: 9, color: ROLE_COLORS[m.role] ?? 'var(--text-muted)' }}>{ROLE_LABELS[m.role] ?? m.role}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERM_GROUPS.map(group => (
                <GroupRows key={group.label} group={group} members={members} isOn={isOn} isCustom={isCustom} toggle={togglePerm} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

/* ── Group rows (extracted to avoid key warnings with fragments) ── */

function GroupRows({ group, members, isOn, isCustom, toggle }: {
  group: typeof PERM_GROUPS[number]
  members: TeamMember[]
  isOn: (m: TeamMember, k: string) => boolean
  isCustom: (m: TeamMember, k: string) => boolean
  toggle: (m: TeamMember, k: string) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={1 + members.length} style={{ padding: '10px 16px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>{group.label}</td>
      </tr>
      {group.keys.map(({ key, label }) => (
        <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
          <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1 }}>{label}</td>
          {members.map(m => {
            const on = isOn(m, key)
            const custom = isCustom(m, key)
            const bgColor = on ? (custom ? '#a855f7' : '#f97316') : 'var(--border)'
            return (
              <td key={m.id} style={{ padding: '10px 16px', textAlign: 'center', opacity: m.isActive ? 1 : 0.4 }}>
                <div onClick={() => toggle(m, key)} style={{
                  width: 36, height: 20, borderRadius: 999, background: bgColor,
                  display: 'inline-flex', alignItems: 'center', padding: '0 2px',
                  cursor: m.isActive ? 'pointer' : 'not-allowed',
                  justifyContent: on ? 'flex-end' : 'flex-start',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: on ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
