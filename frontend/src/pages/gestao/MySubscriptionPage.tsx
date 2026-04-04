import { CreditCard, QrCode, FileText, Download } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

const payments = [
  { period: 'Abril/2026', value: 'R$ 349,00', due: '05/04/2026', paid: '05/04/2026', status: 'Pago' as const },
  { period: 'Março/2026', value: 'R$ 349,00', due: '05/03/2026', paid: '04/03/2026', status: 'Pago' as const },
  { period: 'Fevereiro/2026', value: 'R$ 349,00', due: '05/02/2026', paid: '05/02/2026', status: 'Pago' as const },
  { period: 'Janeiro/2026', value: 'R$ 349,00', due: '05/01/2026', paid: '07/01/2026', status: 'Pago' as const },
  { period: 'Dezembro/2025', value: 'R$ 349,00', due: '05/12/2025', paid: '05/12/2025', status: 'Pago' as const },
  { period: 'Novembro/2025', value: 'R$ 349,00', due: '05/11/2025', paid: '—', status: 'Vencido' as const },
]

const statusStyle: Record<string, { bg: string; color: string }> = {
  Pago: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  Vencido: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  Pendente: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
}

const plans = [
  { name: 'Solo', price: 'R$ 69', users: '1', leads: '1.000', funnels: '1', automations: '0', forms: '0', tracking: false, support: 'E-mail' },
  { name: 'Essencial', price: 'R$ 197', users: '3', leads: '5.000', funnels: '3', automations: '3', forms: '3', tracking: true, support: 'E-mail + Chat' },
  { name: 'Pro', price: 'R$ 349', users: '5', leads: '10.000', funnels: '10', automations: '10', forms: '10', tracking: true, support: 'Prioritário', current: true },
  { name: 'Enterprise', price: 'R$ 649', users: '10', leads: '50.000', funnels: '10', automations: 'Ilimitadas', forms: 'Ilimitados', tracking: true, support: 'Dedicado' },
]

const features = ['Usuários', 'Leads', 'Funis', 'Automações', 'Formulários', 'Rastreamento e-mail', 'Suporte']

const thS: React.CSSProperties = { padding: '12px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: '#e8eaf0', borderBottom: '1px solid #22283a' }
const card: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 12 }

export default function MySubscriptionPage() {
  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Minha Assinatura</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Gerencie seu plano e pagamentos</p>
      </div>

      {/* Row 1: Plan + Payment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Current plan */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>Plano Pro</span>
            <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>Ativo</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#e8eaf0', marginTop: 8 }}>R$ 349<span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>/mês</span></div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>ou R$ 297/mês no plano anual (15% de desconto)</div>

          <div style={{ borderTop: '1px solid #22283a', marginTop: 16, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Info label="Próximo vencimento" value="05/05/2026" />
            <Info label="Ciclo" value="Mensal" />
            <Info label="Usuários" value="4 / 5 incluídos" />
            <Info label="Leads ativos" value="847 / 10.000" />
            <Info label="Funis" value="1 / 10" />
            <Info label="Automações ativas" value="5 / 10" />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
              <span>Leads ativos</span><span>847 de 10.000 (8%)</span>
            </div>
            <div style={{ background: '#22283a', borderRadius: 3, height: 6 }}>
              <div style={{ width: '8%', height: '100%', background: '#22c55e', borderRadius: 3, minWidth: 4 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fazer upgrade</button>
            <button style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>Mudar para anual</button>
            <button style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>Cancelar assinatura</button>
          </div>
        </div>

        {/* Payment method */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Método de pagamento</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <CreditCard size={20} color="#f97316" strokeWidth={1.5} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#e8eaf0' }}>•••• •••• •••• 4411</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Vence 08/2028</div>
            </div>
            <span style={{ background: '#22283a', color: '#9ca3af', borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>Principal</span>
          </div>
          <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer', marginBottom: 16 }}>Trocar método</button>

          <div style={{ borderTop: '1px solid #22283a', paddingTop: 16 }}>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Também aceito</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <PayOpt icon={<QrCode size={18} strokeWidth={1.5} />} color="#22c55e" label="PIX" />
              <PayOpt icon={<FileText size={18} strokeWidth={1.5} />} color="#3b82f6" label="Boleto" />
              <PayOpt icon={<CreditCard size={18} strokeWidth={1.5} />} color="#f97316" label="Cartão" />
            </div>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Histórico de pagamentos</span>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>
            <Download size={12} strokeWidth={1.5} /> Exportar CSV
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#0f1117' }}>
            {['Período', 'Valor', 'Vencimento', 'Pagamento', 'Status', 'Ações'].map(h => <th key={h} style={thS}>{h}</th>)}
          </tr></thead>
          <tbody>
            {payments.map(p => {
              const s = statusStyle[p.status] ?? statusStyle.Pendente!
              return (
                <tr key={p.period}>
                  <td style={tdS}>{p.period}</td>
                  <td style={tdS}>{p.value}</td>
                  <td style={tdS}>{p.due}</td>
                  <td style={tdS}>{p.paid}</td>
                  <td style={tdS}><span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{p.status}</span></td>
                  <td style={tdS}>
                    <button style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: p.status === 'Vencido' ? '#ef4444' : '#9ca3af', cursor: 'pointer' }}>
                      {p.status === 'Vencido' ? 'Pagar agora' : 'Ver boleto'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Plan comparison */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0' }}>Compare os planos</span>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Faça upgrade para desbloquear mais recursos</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {plans.map(p => (
            <div key={p.name} style={{ background: '#0f1117', border: p.current ? '2px solid #f97316' : '1px solid #22283a', borderRadius: 12, padding: 16, position: 'relative' }}>
              {p.current && <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%) translateY(-50%)', background: '#f97316', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>Seu plano</div>}
              <div style={{ textAlign: 'center', marginBottom: 12, paddingTop: p.current ? 8 : 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{p.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.current ? '#f97316' : '#e8eaf0', marginTop: 4 }}>{p.price}<span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}>/mês</span></div>
              </div>
              <div style={{ borderTop: '1px solid #22283a', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {features.map((feat, fi) => {
                  const vals = [p.users, p.leads, p.funnels, p.automations, p.forms, p.tracking ? '✅' : '❌', p.support]
                  return (
                    <div key={feat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#6b7280' }}>{feat}</span>
                      <span style={{ color: '#e8eaf0', fontWeight: 500 }}>{vals[fi]}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16 }}>
                {p.current ? (
                  <button disabled style={{ width: '100%', background: '#22283a', color: '#6b7280', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, cursor: 'not-allowed' }}>Plano atual</button>
                ) : p.name === 'Enterprise' ? (
                  <button style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Fazer upgrade</button>
                ) : (
                  <button style={{ width: '100%', background: 'transparent', border: '1px solid #22283a', color: '#9ca3af', borderRadius: 8, padding: '8px 0', fontSize: 12, cursor: 'pointer' }}>Fazer downgrade</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: '#f97316', cursor: 'pointer' }}>Precisa de mais? Fale com nosso time de consultores →</span>
        </div>
      </div>
    </AppLayout>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#e8eaf0', fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function PayOpt({ icon, color, label }: { icon: React.ReactNode; color: string; label: string }) {
  return (
    <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9ca3af', cursor: 'pointer', transition: 'all 0.15s', flex: 1, justifyContent: 'center' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#22283a'; e.currentTarget.style.color = '#9ca3af' }}>
      <span style={{ color: 'inherit' }}>{icon}</span>{label}
    </div>
  )
}
