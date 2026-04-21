import { useState, useEffect } from 'react'
import { GripVertical, Plus, X, CheckSquare, Mail, Calendar, Globe, MoreHorizontal, Info, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import api from '../../services/api'
import { getPipelines, updatePipeline, createPipeline, saveStages, type PipelineDistributionType } from '../../services/pipeline.service'
import { getUsers, getTeams } from '../../services/users.service'
import CompanyTab from '../../components/settings/CompanyTab'

type Tab = 'company' | 'pipeline' | 'loss' | 'tasks' | 'integrations'

// ── Shared styles ──

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

// ── Data ──

// Stage rendered in the Pipeline tab editor. `id` is either the real
// backend UUID (existing stage) or a transient `temp-…` value created
// on the client when the gestor clicks "+ Adicionar etapa". The
// server distinguishes both on the bulk save.
interface Stage { id: string; name: string; color: string; fixed: boolean; active: boolean; sortOrder: number }

interface PipelineSummary {
  id: string
  name: string
  stages: { id: string; name: string; color: string; isFixed: boolean; isActive: boolean; sortOrder: number; type: string }[]
}

const initialReasons = ['Preço alto', 'Sem orçamento no momento', 'Escolheu concorrente', 'Sem interesse', 'Sem retorno', 'Timing errado']

interface MgrTask { id: string; name: string; isActive: boolean; visibleFor: string[] }

const ROLE_LABELS: Record<string, string> = { SELLER: 'Vendedor', TEAM_LEADER: 'Líder', MANAGER: 'Gestor', OWNER: 'Proprietário' }
const VISIBILITY_OPTS = [
  { value: 'SELLER', label: 'Vendedor' },
  { value: 'TEAM_LEADER', label: 'Líder' },
  { value: 'MANAGER', label: 'Gestor' },
  { value: 'ALL', label: 'Todos' },
]

// ── Component ──

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'company', label: 'Empresa' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'loss', label: 'Motivos de Perda' },
    { key: 'tasks', label: 'Tarefas Gerenciais' },
    { key: 'integrations', label: 'Integrações' },
  ]

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Configure seu pipeline e preferências</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 13,
            color: tab === t.key ? '#f97316' : 'var(--text-muted)', fontWeight: tab === t.key ? 500 : 400,
            borderBottom: tab === t.key ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab />}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'loss' && <LossReasonsTab />}
      {tab === 'tasks' && <ManagerialTasksTab />}
      {tab === 'integrations' && <IntegrationsTab />}
    </AppLayout>
  )
}

// ── Pipeline Tab ──

function PipelineTab() {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [stages, setStages] = useState<Stage[]>([])
  const [pristineKey, setPristineKey] = useState<string>('') // serialized snapshot to detect dirty
  const [loading, setLoading] = useState(true)
  const [savingStages, setSavingStages] = useState(false)
  const [newFunnelModal, setNewFunnelModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Build the editor model from a backend pipeline. Stages from the
  // API are the source of truth — fixed flag, sortOrder, color and
  // active state all come from there. Older API responses without
  // `isActive` default to active=true.
  function loadPipelineIntoEditor(p: PipelineSummary | undefined) {
    if (!p) { setStages([]); setPristineKey(''); return }
    const next: Stage[] = p.stages.map(s => ({
      id: s.id,
      name: s.name,
      color: s.color,
      fixed: s.isFixed,
      active: s.isActive ?? true,
      sortOrder: s.sortOrder,
    }))
    setStages(next)
    setPristineKey(serialize(next))
  }

  function serialize(arr: Stage[]): string {
    return JSON.stringify(arr.map((s, i) => ({
      id: s.id.startsWith('temp-') ? '' : s.id,
      n: s.name,
      c: s.color,
      a: s.active,
      o: i,
    })))
  }

  const dirty = serialize(stages) !== pristineKey

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getPipelines()
      .then((data: any[]) => {
        if (!mounted) return
        const list: PipelineSummary[] = (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          stages: (p.stages ?? []).map((s: any) => ({ id: s.id, name: s.name, color: s.color, isFixed: !!s.isFixed, isActive: s.isActive ?? true, sortOrder: s.sortOrder, type: s.type })),
        }))
        setPipelines(list)
        const first = list[0]
        if (first) {
          setActiveId(first.id)
          loadPipelineIntoEditor(first)
        }
      })
      .catch(() => { /* keep empty */ })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function selectPipeline(id: string) {
    if (dirty) {
      const ok = window.confirm('Você tem alterações de etapas não salvas. Trocar de pipeline vai descartá-las. Continuar?')
      if (!ok) return
    }
    setActiveId(id)
    loadPipelineIntoEditor(pipelines.find(p => p.id === id))
  }

  function removeStage(id: string) { setStages(prev => prev.filter(s => s.id !== id)) }
  function renameSt(id: string, name: string) { setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s)) }
  function toggleStage(id: string) {
    // Fixed stages can never be toggled off — they back the WON/LOST
    // flows and the kanban depends on them. Quietly no-op the click.
    setStages(prev => prev.map(s => s.id === id && !s.fixed ? { ...s, active: !s.active } : s))
  }
  function addStage() {
    setStages(prev => {
      const newStage: Stage = {
        id: `temp-${Date.now()}`,
        name: 'Nova etapa',
        color: '#6b7280',
        fixed: false,
        active: true,
        sortOrder: prev.length,
      }
      const firstFixedIdx = prev.findIndex(s => s.fixed)
      if (firstFixedIdx === -1) return [...prev, newStage]
      return [...prev.slice(0, firstFixedIdx), newStage, ...prev.slice(firstFixedIdx)]
    })
  }

  async function handleSaveStages() {
    if (!activeId) return
    if (stages.some(s => !s.name.trim())) { showToast('Toda etapa precisa de um nome', 'err'); return }
    setSavingStages(true)
    try {
      const payload = stages.map((s, i) => ({
        id: s.id.startsWith('temp-') ? undefined : s.id,
        name: s.name.trim(),
        color: s.color,
        sortOrder: i,
        isActive: s.active,
      }))
      const fresh = await saveStages(activeId, payload)
      // Refresh local pipeline + editor with server-returned ids/order
      setPipelines(prev => prev.map(p => p.id === activeId ? { ...p, stages: fresh } : p))
      const next: Stage[] = fresh.map((s: any) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        fixed: !!s.isFixed,
        active: s.isActive ?? true,
        sortOrder: s.sortOrder,
      }))
      setStages(next)
      setPristineKey(serialize(next))
      showToast('Etapas salvas com sucesso')
    } catch (e: any) {
      // Surface the server's diagnostic when present (e.g., the new
      // STAGE_HAS_LEADS conflict) instead of a generic message.
      const apiErr = e?.response?.data?.error
      const code = apiErr?.code
      const msg = apiErr?.message
      console.error('[SettingsPage] saveStages failed', { code, msg, status: e?.response?.status, full: e?.response?.data })
      showToast(msg ?? 'Erro ao salvar etapas', 'err')
    } finally {
      setSavingStages(false)
    }
  }

  async function handleCreateFunnel(name: string) {
    setCreating(true)
    try {
      const created = await createPipeline(name)
      const summary: PipelineSummary = {
        id: created.id,
        name: created.name,
        stages: (created.stages ?? []).map((s: any) => ({ id: s.id, name: s.name, color: s.color, isFixed: !!s.isFixed, isActive: s.isActive ?? true, sortOrder: s.sortOrder, type: s.type })),
      }
      setPipelines(prev => [...prev, summary])
      setActiveId(summary.id)
      loadPipelineIntoEditor(summary)
      setNewFunnelModal(false)
      showToast(`Funil "${name}" criado`)
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Erro ao criar funil', 'err')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
    {toast && (
      <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', borderLeft: `4px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>{toast.msg}</div>
    )}

    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      {pipelines.map(p => (
        <button key={p.id} onClick={() => selectPipeline(p.id)} style={{
          borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          background: activeId === p.id ? 'rgba(249,115,22,0.12)' : 'var(--border)',
          border: `1px solid ${activeId === p.id ? '#f97316' : 'var(--border)'}`,
          color: activeId === p.id ? '#f97316' : 'var(--text-muted)', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {p.name}{activeId === p.id && ' ✓'}
        </button>
      ))}
      <button onClick={() => setNewFunnelModal(true)} style={{
        borderRadius: 999, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
        background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316',
        display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
      }}>
        <Plus size={13} strokeWidth={1.5} /> Novo Funil
      </button>
    </div>

    {loading ? (
      <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Loader2 size={16} className="animate-spin" color="#f97316" />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando pipelines...</span>
      </div>
    ) : pipelines.length === 0 ? (
      <div style={card}>
        <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Nenhum pipeline cadastrado. Clique em "Novo Funil" para criar o primeiro.</div>
      </div>
    ) : (
    <div style={card}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Etapas — {pipelines.find(p => p.id === activeId)?.name ?? ''}</span>
        {dirty && (
          <button onClick={handleSaveStages} disabled={savingStages}
            style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: savingStages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: savingStages ? 0.7 : 1 }}>
            {savingStages && <Loader2 size={13} className="animate-spin" />}
            {savingStages ? 'Salvando...' : 'Salvar etapas'}
          </button>
        )}
      </div>
      {stages.map(s => (
        <div key={s.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <GripVertical size={16} color="var(--border)" style={{ cursor: 'grab', flexShrink: 0 }} />
          <div style={{ width: 4, height: 20, borderRadius: 2, background: s.color, flexShrink: 0 }} />
          <input value={s.name} onChange={e => renameSt(s.id, e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', outline: 'none' }} />
          {s.fixed && <span style={{ background: 'var(--border)', color: 'var(--text-muted)', borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>Fixa</span>}
          <div onClick={() => toggleStage(s.id)} style={{ width: 36, height: 20, borderRadius: 999, background: s.active ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: s.active ? 'flex-end' : 'flex-start', cursor: s.fixed ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: s.fixed ? 0.5 : 1 }} title={s.fixed ? 'Etapas fixas não podem ser desabilitadas' : (s.active ? 'Desabilitar etapa' : 'Habilitar etapa')}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: s.active ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
          </div>
          {!s.fixed && (
            <button onClick={() => removeStage(s.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ))}
      <button onClick={addStage} style={{ width: '100%', padding: 10, background: 'transparent', border: 'none', color: '#f97316', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Plus size={14} strokeWidth={1.5} /> Adicionar etapa
      </button>
      <div style={{ padding: '8px 20px 16px', fontSize: 12, color: 'var(--text-muted)' }}>As etapas Venda Realizada e Perdido são fixas e não podem ser removidas.</div>
    </div>
    )}

    {newFunnelModal && <NewFunnelModal onClose={() => setNewFunnelModal(false)} onCreate={handleCreateFunnel} currentCount={pipelines.length} creating={creating} />}

    <div style={{ marginTop: 20 }}>
      <DistributionRuleCard pipelines={pipelines} />
    </div>
    </>
  )
}

// ── Distribution Rule Card (real API, isolated from the mocked stages above) ──

interface PipelineLite {
  id: string
  name: string
  distributionType: PipelineDistributionType
  teamId: string | null
  specificUserId: string | null
}

interface UserLite { id: string; name: string }
interface TeamLite { id: string; name: string }

function DistributionRuleCard({ pipelines }: { pipelines: PipelineSummary[] }) {
  // Distribution settings live on the Pipeline row but aren't carried
  // by PipelineSummary (which only ships id/name/stages). We refetch
  // /pipelines once on mount AND any time the parent's pipeline count
  // changes — that catches a freshly-created funnel without forcing
  // a page reload.
  const [pipelinesList, setPipelinesList] = useState<PipelineLite[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [teams, setTeams] = useState<TeamLite[]>([])
  // Seed selectedId from the parent's already-loaded pipelines (when
  // available) so the <select> has a valid bound value from the very
  // first render. If the parent is still loading (pipelines === []),
  // falls back to '' and the useEffect below fills it in once the
  // inner fetch resolves. Prevents the class of bug where the native
  // <select> renders the first <option> visually but the state says
  // '', tripping the "Selecione um pipeline" guard on save.
  const [selectedId, setSelectedId] = useState<string>(pipelines[0]?.id ?? '')
  const [distType, setDistType] = useState<PipelineDistributionType>('MANUAL')
  const [teamId, setTeamId] = useState('')
  const [specificUserId, setSpecificUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([getPipelines(), getUsers(), getTeams()])
      .then(([ps, us, ts]) => {
        if (!mounted) return
        const list: PipelineLite[] = (ps ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          distributionType: p.distributionType ?? 'MANUAL',
          teamId: p.teamId ?? null,
          specificUserId: p.specificUserId ?? null,
        }))
        setPipelinesList(list)
        setUsers((us ?? []).map((u: any) => ({ id: u.id, name: u.name })))
        setTeams((ts ?? []).map((t: any) => ({ id: t.id, name: t.name })))
        // Preserve selection across reloads when possible; otherwise
        // seed with the first pipeline's REAL id. All setters are
        // plain calls (no nested setState) so React 18 batches them
        // into a single render and no stale value leaks through.
        const keep = selectedId && list.find(p => p.id === selectedId)
        const target = keep ?? list[0]
        if (target) {
          setSelectedId(target.id)
          setDistType(target.distributionType)
          setTeamId(target.teamId ?? '')
          setSpecificUserId(target.specificUserId ?? '')
        } else {
          setSelectedId('')
        }
      })
      .catch(() => { /* keep empty */ })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelines.length])

  function handleSelectPipeline(id: string) {
    setSelectedId(id)
    const p = pipelinesList.find(x => x.id === id)
    if (p) {
      setDistType(p.distributionType)
      setTeamId(p.teamId ?? '')
      setSpecificUserId(p.specificUserId ?? '')
    }
  }

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave() {
    if (!selectedId) {
      showToast('Selecione um pipeline antes de salvar a regra', 'err')
      return
    }
    if (distType === 'ROUND_ROBIN_TEAM' && !teamId) { showToast('Selecione uma equipe', 'err'); return }
    if (distType === 'SPECIFIC_USER' && !specificUserId) { showToast('Selecione um vendedor', 'err'); return }
    setSaving(true)
    const payload = {
      distributionType: distType,
      teamId: distType === 'ROUND_ROBIN_TEAM' ? teamId : null,
      specificUserId: distType === 'SPECIFIC_USER' ? specificUserId : null,
    }
    console.info('[DistributionRule] PATCH /pipelines/' + selectedId, payload)
    try {
      const updated = await updatePipeline(selectedId, payload)
      console.info('[DistributionRule] save OK', { id: updated?.id, distributionType: updated?.distributionType, teamId: updated?.teamId, specificUserId: updated?.specificUserId })
      setPipelinesList(prev => prev.map(p => p.id === selectedId
        ? { ...p, distributionType: updated.distributionType, teamId: updated.teamId ?? null, specificUserId: updated.specificUserId ?? null }
        : p,
      ))
      // Mirror the response back into the local form so a stale value
      // never lingers if the server normalised the payload (e.g. empty
      // string → null).
      setDistType(updated.distributionType)
      setTeamId(updated.teamId ?? '')
      setSpecificUserId(updated.specificUserId ?? '')
      showToast('Regra de distribuição salva com sucesso')
    } catch (e: any) {
      const apiErr = e?.response?.data?.error
      console.error('[DistributionRule] save FAILED', { status: e?.response?.status, code: apiErr?.code, message: apiErr?.message, full: e?.response?.data })
      showToast(apiErr?.message ?? 'Erro ao salvar regra de distribuição', 'err')
    } finally {
      setSaving(false)
    }
  }

  const radios: { k: PipelineDistributionType; l: string; d: string }[] = [
    { k: 'MANUAL', l: 'Manual', d: 'O vendedor é escolhido na hora de criar o lead' },
    { k: 'ROUND_ROBIN_ALL', l: 'Round-robin automático', d: 'Distribui em sequência entre todos os vendedores ativos' },
    { k: 'ROUND_ROBIN_TEAM', l: 'Por equipe', d: 'Distribui em round-robin entre os membros de uma equipe específica' },
    { k: 'SPECIFIC_USER', l: 'Vendedor fixo', d: 'Todos os leads vão para um vendedor específico' },
  ]

  return (
    <div style={card}>
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', borderLeft: `4px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>{toast.msg}</div>
      )}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Regra de distribuição de leads</span>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Define como novos leads criados manualmente neste pipeline são atribuídos aos vendedores</div>
      </div>

      {loading ? (
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader2 size={16} className="animate-spin" color="#f97316" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</span>
        </div>
      ) : pipelinesList.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Nenhum pipeline cadastrado.</div>
      ) : (
        <div style={{ padding: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Pipeline</label>
          <select value={selectedId} onChange={e => handleSelectPipeline(e.target.value)}
            style={{ ...inputS, appearance: 'none', cursor: 'pointer', marginBottom: 16 }}>
            {pipelinesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Como distribuir novos leads?</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {radios.map(opt => {
              const active = distType === opt.k
              return (
                <label key={opt.k} onClick={() => setDistType(opt.k)}
                  style={{
                    display: 'flex', gap: 10, padding: 12, cursor: 'pointer',
                    border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
                    background: active ? 'rgba(249,115,22,0.06)' : 'transparent',
                    borderRadius: 8,
                  }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    border: `2px solid ${active ? '#f97316' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.l}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.d}</div>
                  </div>
                </label>
              )
            })}
          </div>

          {distType === 'ROUND_ROBIN_TEAM' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Equipe <span style={{ color: '#f97316' }}>*</span></label>
              <select value={teamId} onChange={e => setTeamId(e.target.value)} style={{ ...inputS, appearance: 'none', cursor: 'pointer' }}>
                <option value="">Selecione uma equipe...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {teams.length === 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>Nenhuma equipe cadastrada.</div>}
            </div>
          )}

          {distType === 'SPECIFIC_USER' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Vendedor <span style={{ color: '#f97316' }}>*</span></label>
              <select value={specificUserId} onChange={e => setSpecificUserId(e.target.value)} style={{ ...inputS, appearance: 'none', cursor: 'pointer' }}>
                <option value="">Selecione um vendedor...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar regra'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── New Funnel Modal ──

function NewFunnelModal({ onClose, onCreate, currentCount, creating = false }: { onClose: () => void; onCreate: (name: string) => void; currentCount: number; creating?: boolean }) {
  const [name, setName] = useState('')
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Criar novo funil</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do funil <span style={{ color: '#f97316' }}>*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pós-Venda, Parceiros, Franquias..." style={inputS} />
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            O novo funil começa com as 7 etapas padrão. Você pode personalizar depois.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Seu plano Pro permite até 10 funis. Você está usando {currentCount} de 10.</div>
        </div>
        <ModalFooter onClose={onClose} onSave={() => { if (name.trim() && !creating) onCreate(name.trim()) }} canSave={!!name.trim() && !creating} label={creating ? 'Criando...' : 'Criar funil'} />
      </div>
    </>
  )
}

// ── Loss Reasons Tab ──

function LossReasonsTab() {
  const [reasons, setReasons] = useState(initialReasons)
  const [editing, setEditing] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)

  function remove(idx: number) { setReasons(p => p.filter((_, i) => i !== idx)) }
  function rename(idx: number, val: string) { setReasons(p => p.map((r, i) => i === idx ? val : r)) }

  function handleSaveReason(name: string) {
    if (editIdx !== null) {
      rename(editIdx, name)
      // API: api.patch(`/loss-reasons/${id}`, { name })
    } else {
      setReasons(p => [...p, name])
      // API: api.post('/loss-reasons', { name })
    }
    setModalOpen(false)
    setEditIdx(null)
  }

  function openEditModal(idx: number) {
    setEditIdx(idx)
    setModalOpen(true)
  }

  return (
    <>
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Motivos de Perda</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Obrigatório selecionar ao mover lead para Perdido</div>
          </div>
          <button onClick={() => { setEditIdx(null); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} strokeWidth={2} /> Adicionar motivo
          </button>
        </div>
        {reasons.map((r, i) => (
          <div key={i} style={{ padding: '12px 20px', borderBottom: i < reasons.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            {editing === i ? (
              <input autoFocus value={r} onChange={e => rename(i, e.target.value)} onBlur={() => setEditing(null)} onKeyDown={e => { if (e.key === 'Enter') setEditing(null) }}
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid #f97316', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }} />
            ) : (
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{r}</span>
            )}
            <button onClick={() => openEditModal(i)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>Editar</button>
            <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
      {modalOpen && <LossReasonModal defaultValue={editIdx !== null ? reasons[editIdx] : ''} onClose={() => { setModalOpen(false); setEditIdx(null) }} onSave={handleSaveReason} isEdit={editIdx !== null} />}
    </>
  )
}

function LossReasonModal({ defaultValue, onClose, onSave, isEdit }: { defaultValue?: string; onClose: () => void; onSave: (name: string) => void; isEdit: boolean }) {
  const [name, setName] = useState(defaultValue ?? '')
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isEdit ? 'Editar motivo' : 'Novo motivo de perda'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do motivo <span style={{ color: '#f97316' }}>*</span></label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Preço alto" style={inputS} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }} />
        </div>
        <ModalFooter onClose={onClose} onSave={() => { if (name.trim()) onSave(name.trim()) }} canSave={!!name.trim()} label={isEdit ? 'Salvar' : 'Adicionar'} />
      </div>
    </>
  )
}

// ── Managerial Tasks Tab ──

function ManagerialTasksTab() {
  const [tasks, setTasks] = useState<MgrTask[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<MgrTask | null>(null)

  function loadTypes() {
    setLoading(true)
    api.get('/tasks/managerial-types').then(r => setTasks(r.data.data ?? [])).catch(() => setTasks([])).finally(() => setLoading(false))
  }
  useState(() => { loadTypes() })

  async function handleToggle(t: MgrTask) {
    try { await api.patch(`/tasks/managerial-types/${t.id}`, { isActive: !t.isActive }); setTasks(p => p.map(x => x.id === t.id ? { ...x, isActive: !x.isActive } : x)) } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try { await api.patch(`/tasks/managerial-types/${id}`, { isActive: false }); setOpenMenu(null); loadTypes() } catch { /* ignore */ }
  }

  async function handleSave(name: string, visibleFor: string[], typeId?: string) {
    if (typeId) {
      await api.patch(`/tasks/managerial-types/${typeId}`, { name, visibleFor })
    } else {
      await api.post('/tasks/managerial-types', { name, visibleFor })
    }
    setModalOpen(false)
    setEditingType(null)
    loadTypes()
  }

  return (
    <>
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tipos de Tarefa Gerencial</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Tarefas criadas pelo gestor para a equipe — não vinculadas a leads</div>
          </div>
          <button onClick={() => { setEditingType(null); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} strokeWidth={2} /> Novo tipo
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum tipo cadastrado</div>
        ) : tasks.map(t => (
          <div key={t.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, opacity: t.isActive ? 1 : 0.6 }}>
            <CheckSquare size={16} color="#f97316" strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{t.name}</span>
            <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'flex-end', marginRight: 8 }}>
              {(t.visibleFor.length === 4 || t.visibleFor.includes('ALL') ? ['Todos'] : t.visibleFor).map(r => (
                <span key={r} style={{ background: 'rgba(249,115,22,0.08)', color: '#f97316', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 500 }}>{ROLE_LABELS[r] ?? r}</span>
              ))}
            </div>
            <div onClick={() => handleToggle(t)} style={{ width: 36, height: 20, borderRadius: 999, background: t.isActive ? '#f97316' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: t.isActive ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.isActive ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
              {openMenu === t.id && (
                <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 130, padding: '4px 0' }}>
                  <div onClick={() => { setEditingType(t); setModalOpen(true); setOpenMenu(null) }} style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>Editar</div>
                  <div onClick={() => handleDelete(t.id)} style={{ padding: '8px 14px', fontSize: 13, color: '#ef4444', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>Excluir</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {modalOpen && <NewTaskTypeModal editType={editingType} onClose={() => { setModalOpen(false); setEditingType(null) }} onSave={handleSave} />}
    </>
  )
}

function NewTaskTypeModal({ editType, onClose, onSave }: { editType: MgrTask | null; onClose: () => void; onSave: (name: string, visibleFor: string[], typeId?: string) => void }) {
  const isEdit = !!editType
  const [name, setName] = useState(editType?.name ?? '')
  const [visibleFor, setVisibleFor] = useState<string[]>(() => {
    if (!editType) return ['ALL']
    const vf = editType.visibleFor
    if (vf.length === 4) return ['ALL']
    return vf
  })

  function toggleVisibility(value: string) {
    if (value === 'ALL') {
      setVisibleFor(['ALL'])
    } else {
      setVisibleFor(prev => {
        const without = prev.filter(v => v !== 'ALL')
        const has = without.includes(value)
        const next = has ? without.filter(v => v !== value) : [...without, value]
        return next.length === 0 ? ['ALL'] : next
      })
    }
  }

  function resolveVisibleFor(): string[] {
    if (visibleFor.includes('ALL')) return ['SELLER', 'TEAM_LEADER', 'MANAGER', 'OWNER']
    return visibleFor
  }

  const canSave = name.trim().length > 0 && visibleFor.length > 0

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isEdit ? 'Editar tipo de tarefa' : 'Novo tipo de tarefa'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome do tipo <span style={{ color: '#f97316' }}>*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Feedback individual" style={inputS} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Visível para <span style={{ color: '#f97316' }}>*</span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {VISIBILITY_OPTS.map(opt => {
                const active = visibleFor.includes(opt.value)
                return (
                  <button key={opt.value} onClick={() => toggleVisibility(opt.value)} style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: active ? 'rgba(249,115,22,0.12)' : 'transparent',
                    border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
                    color: active ? '#f97316' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>{opt.label}</button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              {visibleFor.includes('ALL') ? 'Visível para todos os perfis' : `Visível para: ${visibleFor.map(v => ROLE_LABELS[v] ?? v).join(', ')}`}
            </div>
          </div>
        </div>
        <ModalFooter onClose={onClose} onSave={() => { if (canSave) onSave(name.trim(), resolveVisibleFor(), editType?.id) }} canSave={canSave} label={isEdit ? 'Salvar' : 'Criar tipo'} />
      </div>
    </>
  )
}

// ── Integrations Tab ──

function IntegrationsTab() {
  const [comingSoon, setComingSoon] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [toast, setToast] = useState('')

  // Check status on mount
  useState(() => {
    api.get('/oauth/google/status').then(res => {
      const data = res.data?.data
      if (data?.connected) { setGmailConnected(true); setGmailEmail(data.email) }
    }).catch(() => {})

    api.get('/oauth/calendar/status').then(res => {
      const data = res.data?.data
      if (data?.connected) { setCalendarConnected(true); setCalendarEmail(data.email) }
    }).catch(() => {})

    // Check URL params for successful connection
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    if (connected === 'gmail') {
      setGmailConnected(true)
      setToast('Gmail conectado com sucesso!')
      setTimeout(() => setToast(''), 4000)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (connected === 'calendar') {
      setCalendarConnected(true)
      setToast('Google Calendar conectado com sucesso!')
      setTimeout(() => setToast(''), 4000)
      window.history.replaceState({}, '', window.location.pathname)
    }
  })

  async function handleConnectGmail() {
    setGmailLoading(true)
    try {
      const res = await api.get('/oauth/google/authorize')
      const url = res.data?.data?.url
      if (url) window.location.href = url
    } catch { setGmailLoading(false) }
  }

  async function handleConnectCalendar() {
    setCalendarLoading(true)
    try {
      const res = await api.get('/oauth/calendar/authorize')
      const url = res.data?.data?.url
      if (url) window.location.href = url
    } catch { setCalendarLoading(false) }
  }

  function IntegrationCard({ icon: Icon, iconColor, iconBg, name, desc, connected, email, loading: isLoading, onConnect, btnLabel }: {
    icon: typeof Mail; iconColor: string; iconBg: string; name: string; desc: string
    connected: boolean; email: string | null; loading: boolean
    onConnect: () => void; btnLabel: string
  }) {
    return (
      <div style={{ background: 'var(--bg-card)', border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} color={iconColor} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
            <span style={{ fontSize: 10, fontWeight: 500, borderRadius: 999, padding: '2px 8px', background: connected ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: connected ? '#22c55e' : 'var(--text-muted)' }}>
              {connected ? 'Conectado' : 'Não conectado'}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>{desc}</p>
        {email && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>{email}</p>}
        {!email && <div style={{ marginBottom: 14 }} />}
        {connected ? (
          <button style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'default' }}>Conectado ✓</button>
        ) : (
          <button onClick={onConnect} disabled={isLoading} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isLoading ? 'Redirecionando...' : btnLabel}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <IntegrationCard icon={Mail} iconColor="#ef4444" iconBg="rgba(239,68,68,0.12)" name="Gmail" desc="Envie e-mails para leads diretamente pelo TriboCRM com rastreamento de abertura" connected={gmailConnected} email={gmailEmail} loading={gmailLoading} onConnect={handleConnectGmail} btnLabel="Conectar Gmail" />
        <IntegrationCard icon={Calendar} iconColor="#3b82f6" iconBg="rgba(59,130,246,0.12)" name="Google Calendar" desc="Crie eventos automaticamente ao agendar tarefas no TriboCRM" connected={calendarConnected} email={calendarEmail} loading={calendarLoading} onConnect={handleConnectCalendar} btnLabel="Conectar Calendar" />

        {/* Chrome Extension */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={20} color="#22c55e" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Extensão do Chrome</div>
              <span style={{ fontSize: 10, fontWeight: 500, borderRadius: 999, padding: '2px 8px', background: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)' }}>Não instalada</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>Capture leads do LinkedIn, Gmail e envie WhatsApp direto pelo CRM</p>
          <button onClick={() => setComingSoon(true)} style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Instalar extensão</button>
        </div>
      </div>
      {comingSoon && <ComingSoonModal onClose={() => setComingSoon(false)} />}
    </>
  )
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, padding: 24, textAlign: 'center' }}>
        <Info size={32} color="#3b82f6" strokeWidth={1.5} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Integração em breve</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>Esta funcionalidade será ativada em breve. Você receberá uma notificação quando estiver disponível.</p>
        <button onClick={onClose} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Entendi</button>
      </div>
    </>
  )
}

// ── Shared Modal Footer ──

function ModalFooter({ onClose, onSave, canSave, label }: { onClose: () => void; onSave: () => void; canSave: boolean; label: string }) {
  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
      <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
      <button onClick={onSave} disabled={!canSave} style={{ background: canSave ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>{label}</button>
    </div>
  )
}
