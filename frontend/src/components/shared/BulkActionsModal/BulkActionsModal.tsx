import { useState } from 'react'
import { X, Loader2, UserCheck, ArrowRight, Thermometer, Shuffle, Trash2, AlertTriangle } from 'lucide-react'
import { bulkUpdateLeads } from '../../../services/leads.service'

interface UserOption { id: string; name: string }
interface TeamOption { id: string; name: string }
interface StageOption { id: string; name: string; color: string }

interface Props {
  leadIds: string[]
  onClose: () => void
  onDone: (msg: string) => void
  users: UserOption[]
  teams: TeamOption[]
  stages: StageOption[]
}

type Action = 'change_responsible' | 'change_stage' | 'change_temperature' | 'redistribute' | 'delete'
type DistType = 'ROUND_ROBIN_ALL' | 'SPECIFIC_USER' | 'ROUND_ROBIN_TEAM'

const actions: { k: Action; l: string; icon: typeof UserCheck; color: string; destructive?: boolean }[] = [
  { k: 'change_responsible', l: 'Mudar responsável', icon: UserCheck, color: '#3b82f6' },
  { k: 'change_stage', l: 'Mudar de etapa', icon: ArrowRight, color: '#a855f7' },
  { k: 'change_temperature', l: 'Mudar temperatura', icon: Thermometer, color: '#f59e0b' },
  { k: 'redistribute', l: 'Redistribuir para', icon: Shuffle, color: '#22c55e' },
  { k: 'delete', l: 'Excluir da conta', icon: Trash2, color: '#ef4444', destructive: true },
]

const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer' }

export default function BulkActionsModal({ leadIds, onClose, onDone, users, teams, stages }: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')

  // Payload fields
  const [responsibleId, setResponsibleId] = useState('')
  const [stageId, setStageId] = useState('')
  const [temperature, setTemperature] = useState<'HOT' | 'WARM' | 'COLD'>('HOT')
  const [distType, setDistType] = useState<DistType>('ROUND_ROBIN_ALL')
  const [distUserId, setDistUserId] = useState('')
  const [distTeamId, setDistTeamId] = useState('')

  function canExecute(): boolean {
    if (!action) return false
    if (action === 'change_responsible') return !!responsibleId
    if (action === 'change_stage') return !!stageId
    if (action === 'change_temperature') return true
    if (action === 'redistribute') {
      if (distType === 'SPECIFIC_USER') return !!distUserId
      if (distType === 'ROUND_ROBIN_TEAM') return !!distTeamId
      return true
    }
    if (action === 'delete') return true
    return false
  }

  function buildPayload(): Record<string, unknown> {
    if (action === 'change_responsible') return { responsibleId }
    if (action === 'change_stage') return { stageId }
    if (action === 'change_temperature') return { temperature }
    if (action === 'redistribute') return {
      distributionType: distType,
      responsibleId: distType === 'SPECIFIC_USER' ? distUserId : undefined,
      teamId: distType === 'ROUND_ROBIN_TEAM' ? distTeamId : undefined,
    }
    return {}
  }

  async function handleExecute() {
    if (!action || !canExecute()) return
    setExecuting(true); setError('')
    try {
      const result = await bulkUpdateLeads(leadIds, action, buildPayload())
      const n = result.updated
      const labels: Record<string, string> = {
        change_responsible: `Responsável alterado em ${n} lead(s)`,
        change_stage: `Etapa alterada em ${n} lead(s)`,
        change_temperature: `Temperatura alterada em ${n} lead(s)`,
        redistribute: `${n} lead(s) redistribuído(s)`,
        delete: `${n} lead(s) excluído(s)`,
      }
      onDone(labels[action] ?? `${n} lead(s) atualizado(s)`)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao executar ação')
      setExecuting(false)
      setConfirming(false)
    }
  }

  const count = leadIds.length

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Ações em lote</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{count} lead{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {confirming ? (
            /* Confirmation screen */
            <div style={{ textAlign: 'center' }}>
              <AlertTriangle size={40} color="#f59e0b" strokeWidth={1.5} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '12px 0 8px' }}>Atenção</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
                Após executar essa ação não será possível reverter. Tem certeza?
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {actions.find(a => a.k === action)?.l} em {count} lead{count !== 1 ? 's' : ''}
              </p>
              {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
            </div>
          ) : (
            /* Action picker */
            <>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>Selecione a ação</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {actions.map(a => {
                  const Icon = a.icon
                  const active = action === a.k
                  return (
                    <label key={a.k} onClick={() => setAction(a.k)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer',
                      border: `1px solid ${active ? a.color : a.destructive ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                      background: active ? `${a.color}0D` : 'transparent', borderRadius: 8,
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${active ? a.color : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />}
                      </div>
                      <Icon size={16} color={a.color} strokeWidth={1.5} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: a.destructive && active ? '#ef4444' : 'var(--text-primary)' }}>{a.l}</span>
                    </label>
                  )
                })}
              </div>

              {/* Action-specific payload */}
              {action === 'change_responsible' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Novo responsável</label>
                  <select value={responsibleId} onChange={e => setResponsibleId(e.target.value)} style={inputS}>
                    <option value="">Selecione...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {action === 'change_stage' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nova etapa</label>
                  <select value={stageId} onChange={e => setStageId(e.target.value)} style={inputS}>
                    <option value="">Selecione...</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {action === 'change_temperature' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {([{ k: 'HOT' as const, l: 'Quente', c: '#f97316' }, { k: 'WARM' as const, l: 'Morno', c: '#f59e0b' }, { k: 'COLD' as const, l: 'Frio', c: '#3b82f6' }]).map(t => {
                    const active = temperature === t.k
                    return (
                      <div key={t.k} onClick={() => setTemperature(t.k)} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${active ? t.c : 'var(--border)'}`, background: active ? `${t.c}0D` : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: active ? t.c : 'var(--text-primary)' }}>{t.l}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {action === 'redistribute' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    { k: 'ROUND_ROBIN_ALL' as DistType, l: 'Todos os vendedores (round-robin)' },
                    { k: 'SPECIFIC_USER' as DistType, l: 'Vendedor específico' },
                    { k: 'ROUND_ROBIN_TEAM' as DistType, l: 'Equipe' },
                  ]).map(d => {
                    const active = distType === d.k
                    return (
                      <label key={d.k} onClick={() => setDistType(d.k)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? '#f97316' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f97316' }} />}
                        </div>
                        {d.l}
                      </label>
                    )
                  })}
                  {distType === 'SPECIFIC_USER' && (
                    <select value={distUserId} onChange={e => setDistUserId(e.target.value)} style={inputS}>
                      <option value="">Selecione vendedor...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  )}
                  {distType === 'ROUND_ROBIN_TEAM' && (
                    <select value={distTeamId} onChange={e => setDistTeamId(e.target.value)} style={inputS}>
                      <option value="">Selecione equipe...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {action === 'delete' && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>
                  {count} lead{count !== 1 ? 's' : ''} ser{count !== 1 ? 'ão' : 'á'} excluído{count !== 1 ? 's' : ''} permanentemente (soft delete). Leads excluídos não contam no limite do plano.
                </div>
              )}

              {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={confirming ? () => setConfirming(false) : onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {confirming ? '← Voltar' : 'Cancelar'}
          </button>
          {confirming ? (
            <button onClick={handleExecute} disabled={executing} style={{ background: action === 'delete' ? '#ef4444' : '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: executing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: executing ? 0.7 : 1 }}>
              {executing && <Loader2 size={14} className="animate-spin" />}
              {executing ? 'Executando...' : 'Sim, executar'}
            </button>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={!canExecute()} style={{ background: canExecute() ? (action === 'delete' ? '#ef4444' : '#f97316') : 'var(--border)', color: canExecute() ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: canExecute() ? 'pointer' : 'not-allowed' }}>
              Continuar →
            </button>
          )}
        </div>
      </div>
    </>
  )
}
