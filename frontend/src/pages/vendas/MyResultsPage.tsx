import { useState } from 'react'
import {
  TrendingUp, CheckCircle2, Target, Trophy, Phone, MessageCircle,
  Mail, Video, Handshake, type LucideIcon,
} from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'

type Period = 'month' | 'quarter' | 'semester' | 'year'

const kpis = [
  { label: 'Receita Fechada', value: 'R$ 38.000', variation: '↑ 95% da meta', variationColor: '#22c55e', icon: TrendingUp, iconColor: '#22c55e' },
  { label: 'Leads Fechados', value: '8', variation: '↑ +2 vs mês ant.', variationColor: '#22c55e', icon: CheckCircle2, iconColor: '#f97316' },
  { label: 'Taxa de Conversão', value: '25%', variation: '↑ +3pp vs mês ant.', variationColor: '#22c55e', icon: Target, iconColor: '#f97316' },
  { label: 'Posição no Ranking', value: '1º lugar', variation: 'equipe de 5 pessoas', variationColor: '#9ca3af', icon: Trophy, iconColor: '#f59e0b' },
]

const activities = [
  { icon: Phone, color: '#f97316', label: 'Ligações', done: 24, goal: 30 },
  { icon: MessageCircle, color: '#25d166', label: 'WhatsApp', done: 31, goal: 30 },
  { icon: Mail, color: '#3b82f6', label: 'E-mails', done: 18, goal: 20 },
  { icon: Video, color: '#a855f7', label: 'Reuniões', done: 6, goal: 8 },
  { icon: Handshake, color: '#f59e0b', label: 'Visitas', done: 2, goal: 4 },
]

const lossReasons = [
  { reason: 'Preço alto', count: 2, pct: 67, color: '#ef4444' },
  { reason: 'Sem orçamento', count: 1, pct: 33, color: '#f59e0b' },
]

interface HistoryItem { icon: LucideIcon; color: string; title: string; detail: string; time: string }

const historyItems: HistoryItem[] = [
  { icon: Mail, color: '#3b82f6', title: 'E-mail enviado para Camila Torres', detail: 'Proposta comercial', time: 'hoje 09:15' },
  { icon: Phone, color: '#f97316', title: 'Ligação para Roberto Souza', detail: 'Demonstrou interesse', time: 'ontem 14:30' },
  { icon: MessageCircle, color: '#25d166', title: 'WhatsApp para Fernanda Lima', detail: 'Primeiro contato', time: 'ontem 10:00' },
  { icon: CheckCircle2, color: '#22c55e', title: 'Venda fechada — Torres & Filhos', detail: 'R$ 12.000', time: 'há 2 dias' },
  { icon: Video, color: '#a855f7', title: 'Reunião online — GomesTech', detail: 'Demo ao vivo', time: 'há 3 dias' },
  { icon: Phone, color: '#f97316', title: 'Ligação para Ana Lima', detail: 'Qualificação', time: 'há 3 dias' },
  { icon: Mail, color: '#3b82f6', title: 'E-mail — MendesNet', detail: 'Follow-up proposta', time: 'há 4 dias' },
  { icon: CheckCircle2, color: '#22c55e', title: 'Venda fechada — RS Comércio', detail: 'R$ 8.500', time: 'há 5 dias' },
  { icon: MessageCircle, color: '#25d166', title: 'WhatsApp — Pedro Alves', detail: 'Agendamento de reunião', time: 'há 6 dias' },
  { icon: Phone, color: '#f97316', title: 'Ligação — Costa Digital', detail: 'Sem resposta', time: 'há 7 dias' },
]

function barColor(pct: number) { return pct >= 90 ? '#22c55e' : pct >= 60 ? '#f97316' : '#ef4444' }

const thS: React.CSSProperties = { padding: '10px 16px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }
const tdS: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: '#e8eaf0', borderBottom: '1px solid #22283a' }
const card: React.CSSProperties = { background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }

export default function MyResultsPage() {
  const [period, setPeriod] = useState<Period>('month')

  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: 'Este mês' }, { key: 'quarter', label: 'Trimestre' },
    { key: 'semester', label: 'Semestre' }, { key: 'year', label: 'Ano' },
  ]

  const totalDone = activities.reduce((s, a) => s + a.done, 0)
  const totalGoal = activities.reduce((s, a) => s + a.goal, 0)

  return (
    <AppLayout menuItems={vendasMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Meus Resultados</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: period === p.key ? 'rgba(249,115,22,0.12)' : '#161a22',
              border: `1px solid ${period === p.key ? '#f97316' : '#22283a'}`,
              color: period === p.key ? '#f97316' : '#6b7280', transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, padding: 20, position: 'relative' }}>
              <Icon size={20} color={k.iconColor} strokeWidth={1.5} style={{ position: 'absolute', top: 20, right: 20 }} />
              <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>{k.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', display: 'block' }}>{k.value}</span>
              <span style={{ fontSize: 12, color: k.variationColor, marginTop: 4, display: 'block' }}>{k.variation}</span>
            </div>
          )
        })}
      </div>

      {/* Goal progress */}
      <div style={{ ...card, padding: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Minha Meta de Abril</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>95% concluído</span>
        </div>
        <div style={{ background: '#22283a', borderRadius: 999, height: 8, margin: '12px 0' }}>
          <div style={{ width: '95%', height: '100%', background: 'linear-gradient(to right, #f97316, #fb923c)', borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: '#e8eaf0' }}>R$ 38.000 realizados</span>
          <span style={{ color: '#6b7280' }}>Meta: R$ 40.000</span>
          <span style={{ color: '#22c55e' }}>Faltam R$ 2.000</span>
        </div>
      </div>

      {/* Activities + Loss reasons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Activities */}
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Atividades do mês</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#0f1117' }}>
              {['Tipo', 'Realizadas', 'Meta', ''].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr></thead>
            <tbody>
              {activities.map(a => {
                const Icon = a.icon; const pct = Math.round((a.done / a.goal) * 100)
                return (
                  <tr key={a.label}>
                    <td style={tdS}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={14} color={a.color} strokeWidth={1.5} /><span>{a.label}</span>
                      </div>
                    </td>
                    <td style={{ ...tdS, fontWeight: 700 }}>{a.done}</td>
                    <td style={tdS}>{a.goal}</td>
                    <td style={{ ...tdS, width: 90 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, background: '#22283a', borderRadius: 3, height: 6 }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor(pct), borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: barColor(pct), fontWeight: 600, minWidth: 28 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: '#0f1117' }}>
                <td style={{ ...tdS, fontWeight: 700, borderBottom: 'none' }}>Total</td>
                <td style={{ ...tdS, fontWeight: 700, borderBottom: 'none' }}>{totalDone}</td>
                <td style={{ ...tdS, fontWeight: 700, borderBottom: 'none' }}>{totalGoal}</td>
                <td style={{ ...tdS, borderBottom: 'none' }} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Loss reasons + ranking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Motivos de perda</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>3 leads perdidos este mês</span>
            </div>
            {lossReasons.map(lr => (
              <div key={lr.reason} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span style={{ color: '#e8eaf0' }}>{lr.reason}</span>
                  <span style={{ color: '#6b7280' }}>{lr.count} leads · {lr.pct}%</span>
                </div>
                <div style={{ background: '#22283a', borderRadius: 3, height: 6 }}>
                  <div style={{ width: `${lr.pct}%`, height: '100%', background: lr.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Ranking */}
          <div style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <Trophy size={24} color="#f59e0b" strokeWidth={1.5} />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', marginTop: 8 }}>Você está em 1º lugar</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>equipe de 5 pessoas · Abril 2026</div>
            <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 4 }}>O ranking completo é visível apenas para o gestor.</div>
          </div>
        </div>
      </div>

      {/* Activity history */}
      <div style={{ ...card, marginTop: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Histórico de atividades</span>
          <select style={{ background: '#0f1117', border: '1px solid #22283a', borderRadius: 8, padding: '5px 28px 5px 10px', fontSize: 12, color: '#e8eaf0', outline: 'none', cursor: 'pointer', appearance: 'none' as const }}>
            <option>Todos os tipos</option><option>Ligações</option><option>WhatsApp</option><option>E-mails</option><option>Reuniões</option>
          </select>
        </div>
        {historyItems.map((h, i) => {
          const Icon = h.icon
          return (
            <div key={i} style={{ padding: '12px 20px', borderBottom: i < historyItems.length - 1 ? '1px solid #22283a' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${h.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={h.color} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{h.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{h.detail}</div>
              </div>
              <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{h.time}</span>
            </div>
          )
        })}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Mostrando 1-10 de 47 atividades</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #22283a', background: 'transparent', color: '#6b7280', opacity: 0.5, cursor: 'not-allowed' }}>Anterior</button>
            <button style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #22283a', background: '#161a22', color: '#e8eaf0', cursor: 'pointer' }}>Próximo</button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
