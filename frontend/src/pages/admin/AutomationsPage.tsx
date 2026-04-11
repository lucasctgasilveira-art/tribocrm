import { Clock, Mail, Plus, Bell, ShieldCheck, type LucideIcon } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { adminMenuItems } from '../../config/adminMenu'

// Read-only list of the three platform-level automations that live in the
// Super Admin instance per doc section 10.6. They run automatically in the
// backend (see backend/src/jobs/expiry-alert.job.ts and
// backend/src/controllers/users.controller.ts) and cannot be edited from
// the UI — this page exists purely to document them for the Super Admin.

interface SystemAutomationCard {
  id: string
  triggerIcon: LucideIcon
  triggerColor: string
  triggerTitle: string
  triggerSub: string
  actionIcon: LucideIcon
  actionColor: string
  actionTitle: string
}

const systemAutomations: SystemAutomationCard[] = [
  {
    id: 'sys-plan-expiring',
    triggerIcon: Clock,
    triggerColor: '#f59e0b',
    triggerTitle: 'Plano próximo do vencimento (D-3)',
    triggerSub: 'Tenant em ACTIVE/TRIAL',
    actionIcon: Mail,
    actionColor: '#3b82f6',
    actionTitle: 'Enviar aviso por e-mail ao gestor',
  },
  {
    id: 'sys-user-created',
    triggerIcon: Plus,
    triggerColor: '#22c55e',
    triggerTitle: 'Novo usuário cadastrado',
    triggerSub: 'Qualquer instância',
    actionIcon: Mail,
    actionColor: '#3b82f6',
    actionTitle: 'Enviar e-mail de boas-vindas com senha temporária',
  },
  {
    id: 'sys-user-limit',
    triggerIcon: ShieldCheck,
    triggerColor: '#ef4444',
    triggerTitle: 'Limite de usuários do plano atingido',
    triggerSub: 'Qualquer plano',
    actionIcon: Bell,
    actionColor: '#f97316',
    actionTitle: 'Bloquear cadastro + notificar gestor para upgrade',
  },
]

export default function AdminAutomationsPage() {
  return (
    <AppLayout menuItems={adminMenuItems}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Automações</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Automações fixas do sistema. Rodam automaticamente no backend e não podem ser editadas nem desativadas por nenhuma instância.
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: 12 }}>Sistema</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {systemAutomations.map(c => {
            const TIcon = c.triggerIcon
            const AIcon = c.actionIcon
            return (
              <div key={c.id}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, paddingTop: 38, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(168,85,247,0.12)', color: '#a855f7',
                  border: '1px solid rgba(168,85,247,0.3)',
                  borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>Fixa do sistema</div>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TIcon size={16} color={c.triggerColor} strokeWidth={1.5} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{c.triggerTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.triggerSub}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>↓</div>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AIcon size={16} color={c.actionColor} strokeWidth={1.5} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{c.actionTitle}</div>
                    <span style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}>Sistema</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
