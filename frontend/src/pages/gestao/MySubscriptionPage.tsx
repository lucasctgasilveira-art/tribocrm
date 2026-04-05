import { useState, useEffect } from 'react'
import { CreditCard, QrCode, FileText, Download, X, Copy, Loader2, Info } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import api from '../../services/api'

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

const thS: React.CSSProperties = { padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }

export default function MySubscriptionPage() {
  const [pixModal, setPixModal] = useState(false)
  const [boletoModal, setBoletoModal] = useState(false)
  const [cardModal, setCardModal] = useState(false)

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Minha Assinatura</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Gerencie seu plano e pagamentos</p>
      </div>

      {/* Row 1: Plan + Payment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Current plan */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>Plano Pro</span>
            <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>Ativo</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>R$ 349<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/mês</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>ou R$ 297/mês no plano anual (15% de desconto)</div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InfoItem label="Próximo vencimento" value="05/05/2026" />
            <InfoItem label="Ciclo" value="Mensal" />
            <InfoItem label="Usuários" value="4 / 5 incluídos" />
            <InfoItem label="Leads ativos" value="847 / 10.000" />
            <InfoItem label="Funis" value="1 / 10" />
            <InfoItem label="Automações ativas" value="5 / 10" />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Leads ativos</span><span>847 de 10.000 (8%)</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 3, height: 6 }}>
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
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Método de pagamento</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <CreditCard size={20} color="#f97316" strokeWidth={1.5} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>•••• •••• •••• 4411</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vence 08/2028</div>
            </div>
            <span style={{ background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>Principal</span>
          </div>
          <button style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16 }}>Trocar método</button>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, fontWeight: 600 }}>Também aceito</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <PayOpt icon={<QrCode size={18} strokeWidth={1.5} />} color="#22c55e" label="PIX" onClick={() => setPixModal(true)} />
              <PayOpt icon={<FileText size={18} strokeWidth={1.5} />} color="#3b82f6" label="Boleto" onClick={() => setBoletoModal(true)} />
              <PayOpt icon={<CreditCard size={18} strokeWidth={1.5} />} color="#f97316" label="Cartão" onClick={() => setCardModal(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Histórico de pagamentos</span>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Download size={12} strokeWidth={1.5} /> Exportar CSV
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--bg)' }}>
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
                    <button style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: p.status === 'Vencido' ? '#ef4444' : 'var(--text-secondary)', cursor: 'pointer' }}>
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
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Compare os planos</span>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Faça upgrade para desbloquear mais recursos</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {plans.map(p => (
            <div key={p.name} style={{ background: 'var(--bg)', border: p.current ? '2px solid #f97316' : '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'relative' }}>
              {p.current && <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%) translateY(-50%)', background: '#f97316', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>Seu plano</div>}
              <div style={{ textAlign: 'center', marginBottom: 12, paddingTop: p.current ? 8 : 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.current ? '#f97316' : 'var(--text-primary)', marginTop: 4 }}>{p.price}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/mês</span></div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {features.map((feat, fi) => {
                  const vals = [p.users, p.leads, p.funnels, p.automations, p.forms, p.tracking ? '✅' : '❌', p.support]
                  return (
                    <div key={feat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{feat}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{vals[fi]}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16 }}>
                {p.current ? (
                  <button disabled style={{ width: '100%', background: 'var(--border)', color: 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, cursor: 'not-allowed' }}>Plano atual</button>
                ) : p.name === 'Enterprise' ? (
                  <button style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Fazer upgrade</button>
                ) : (
                  <button style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, padding: '8px 0', fontSize: 12, cursor: 'pointer' }}>Fazer downgrade</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: '#f97316', cursor: 'pointer' }}>Precisa de mais? Fale com nosso time de consultores →</span>
        </div>
      </div>

      {/* Modals */}
      {pixModal && <PixModal onClose={() => setPixModal(false)} />}
      {boletoModal && <BoletoModal onClose={() => setBoletoModal(false)} />}
      {cardModal && <ComingSoonModal onClose={() => setCardModal(false)} />}
    </AppLayout>
  )
}

// ── PIX Modal ──

function PixModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pixData, setPixData] = useState<{ pixCopiaECola: string; qrCode: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(1800)

  useEffect(() => {
    api.post('/payments/pix', {
      value: 349, description: 'TriboCRM Pro — Mensal',
      debtorName: 'Cliente TriboCRM', debtorCpf: '00000000000',
    }).then(res => {
      setPixData(res.data.data)
      setLoading(false)
    }).catch(() => {
      setError('Erro ao gerar cobrança PIX')
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!pixData) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [pixData])

  function handleCopy() {
    if (pixData?.pixCopiaECola) {
      navigator.clipboard.writeText(pixData.pixCopiaECola)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pagar com PIX</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          {loading ? (
            <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Loader2 size={22} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Gerando cobrança...</span>
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: '#ef4444', fontSize: 13 }}>{error}</div>
          ) : pixData ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginBottom: 4 }}>R$ 349,00</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>TriboCRM Pro — Mensal</div>

              {pixData.pixCopiaECola ? (
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, display: 'inline-block', marginBottom: 16 }}>
                  <QRCodeSVG value={pixData.pixCopiaECola} size={200} level="M" includeMargin={true} />
                </div>
              ) : (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, marginBottom: 16 }}>
                  <QrCode size={64} color="var(--text-muted)" strokeWidth={1} />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Código PIX copia e cola</div>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', maxHeight: 60, overflow: 'auto', textAlign: 'left' }}>
                  {pixData.pixCopiaECola || 'Código não disponível'}
                </div>
              </div>

              <button onClick={handleCopy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
                <Copy size={14} strokeWidth={1.5} /> {copied ? 'Copiado!' : 'Copiar código PIX'}
              </button>

              <div style={{ fontSize: 12, color: timeLeft < 300 ? '#ef4444' : 'var(--text-muted)' }}>
                Expira em {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

// ── Boleto Modal ──

function BoletoModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [boletoData, setBoletoData] = useState<{ boletoUrl: string; barCode: string; dueDate: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    api.post('/payments/boleto', {
      value: 349, description: 'TriboCRM Pro — Mensal', dueDate,
      debtorName: 'Cliente TriboCRM', debtorCpf: '00000000000',
      debtorEmail: 'cliente@empresa.com',
      debtorStreet: 'Rua Exemplo', debtorCity: 'São Paulo', debtorState: 'SP', debtorZipCode: '01000000',
    }).then(res => {
      setBoletoData(res.data.data)
      setLoading(false)
    }).catch(() => {
      setError('Erro ao gerar boleto')
      setLoading(false)
    })
  }, [])

  function handleCopyBarcode() {
    if (boletoData?.barCode) {
      navigator.clipboard.writeText(boletoData.barCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 460, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pagar com Boleto</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Loader2 size={22} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Gerando boleto...</span>
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>
          ) : boletoData ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>R$ 349,00</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Vencimento: {new Date(boletoData.dueDate).toLocaleDateString('pt-BR')}</div>
              </div>

              {boletoData.barCode && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Código de barras</div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {boletoData.barCode}
                  </div>
                  <button onClick={handleCopyBarcode} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Copy size={12} strokeWidth={1.5} /> {copied ? 'Copiado!' : 'Copiar código'}
                  </button>
                </div>
              )}

              {boletoData.boletoUrl && (
                <a href={boletoData.boletoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                  <FileText size={14} strokeWidth={1.5} /> Abrir boleto em PDF
                </a>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

// ── Coming Soon Modal ──

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, padding: 24, textAlign: 'center' }}>
        <Info size={32} color="#3b82f6" strokeWidth={1.5} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Em breve</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>Pagamento por cartão de crédito estará disponível em breve.</p>
        <button onClick={onClose} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Entendi</button>
      </div>
    </>
  )
}

// ── Sub-components ──

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function PayOpt({ icon, color, label, onClick }: { icon: React.ReactNode; color: string; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s', flex: 1, justifyContent: 'center' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
      <span style={{ color: 'inherit' }}>{icon}</span>{label}
    </div>
  )
}
