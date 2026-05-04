import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Copy, Check, Loader2, Webhook, AlertTriangle, X, Send, RefreshCw, Eye, Power, ChevronLeft } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import {
  listWebhooks, createWebhook, updateWebhook, deleteWebhook,
  testWebhook, getWebhookSecret, listDeliveries, resendDelivery,
  ALL_EVENT_TYPES, EVENT_LABELS,
  type WebhookEndpoint, type CreatedWebhook, type WebhookDelivery, type WebhookEventType,
} from '../../services/webhooks.service'

/**
 * Tela de gestão de webhooks de saída. /gestao/configuracoes/webhooks
 *
 * Estrutura:
 *   - Lista de endpoints (cards com nome, URL truncada, eventos, status)
 *   - Modal de criar/editar
 *   - Modal de "key revelada" pós-criação (mostra secret uma vez)
 *   - Drawer de logs de UM endpoint (entra clicando no card)
 *
 * Apenas OWNER/MANAGER/SUPER_ADMIN cria/edita/exclui (gate UI espelha
 * o gate do backend).
 */

const ROLE = (() => {
  try {
    return (JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string }).role ?? ''
  } catch {
    return ''
  }
})()

const canManage = ROLE === 'OWNER' || ROLE === 'MANAGER' || ROLE === 'SUPER_ADMIN'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const inputS: React.CSSProperties = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [createModal, setCreateModal] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null)
  const [createdSecret, setCreatedSecret] = useState<CreatedWebhook | null>(null)
  const [logsView, setLogsView] = useState<WebhookEndpoint | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listWebhooks()
      setEndpoints(data)
      setError('')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao carregar webhooks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (logsView) {
    return (
      <AppLayout menuItems={gestaoMenuItems}>
        <DeliveriesView
          endpoint={logsView}
          onBack={() => setLogsView(null)}
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Webhooks</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
            Receba notificações em tempo real quando eventos importantes acontecerem no CRM.
          </p>
        </div>
        {canManage && (
          <button onClick={() => setCreateModal(true)} style={{
            background: 'var(--accent)', border: 'none', borderRadius: 8,
            padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={16} strokeWidth={2.5} /> Novo webhook
          </button>
        )}
      </div>

      <div style={{ ...card, padding: 16, marginBottom: 20, display: 'flex', gap: 12 }}>
        <Webhook size={18} color="#f97316" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          O TriboCRM envia um POST pra URL configurada toda vez que um evento selecionado acontece. Útil pra integrar com sistemas externos (planilha, ERP, ferramenta de marketing).
          <br />
          Cada endpoint tem um <strong>secret</strong> usado pra assinar os payloads (HMAC SHA-256). Valide a assinatura antes de processar pra garantir que veio do TriboCRM.
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
      ) : endpoints.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <Webhook size={36} color="var(--text-muted)" strokeWidth={1.2} style={{ display: 'inline-block', marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>Nenhum webhook configurado</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {canManage ? 'Clique em "Novo webhook" pra começar.' : 'Apenas gestores podem configurar webhooks.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {endpoints.map(ep => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              onView={() => setLogsView(ep)}
              onEdit={() => setEditingEndpoint(ep)}
              onChange={load}
            />
          ))}
        </div>
      )}

      {createModal && (
        <CreateOrEditModal
          onClose={() => setCreateModal(false)}
          onCreated={(c) => {
            setCreateModal(false)
            setCreatedSecret(c)
            load()
          }}
        />
      )}

      {editingEndpoint && (
        <CreateOrEditModal
          editing={editingEndpoint}
          onClose={() => setEditingEndpoint(null)}
          onCreated={() => {
            setEditingEndpoint(null)
            load()
          }}
        />
      )}

      {createdSecret && (
        <ShowSecretModal endpoint={createdSecret} onClose={() => setCreatedSecret(null)} />
      )}
    </AppLayout>
  )
}

// ─── Card de cada endpoint ──────────────────────────────────────

function EndpointCard({ endpoint, onView, onEdit, onChange }: {
  endpoint: WebhookEndpoint
  onView: () => void
  onEdit: () => void
  onChange: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function handleTest(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy('test')
    try {
      await testWebhook(endpoint.id)
      alert('Teste disparado. Veja "Logs" em alguns segundos.')
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Erro ao disparar teste')
    } finally {
      setBusy(null)
    }
  }

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy('toggle')
    try {
      await updateWebhook(endpoint.id, { isActive: !endpoint.isActive })
      onChange()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Excluir webhook "${endpoint.name}"? Os logs também serão apagados.`)) return
    setBusy('delete')
    try {
      await deleteWebhook(endpoint.id)
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
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{endpoint.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              background: endpoint.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
              color: endpoint.isActive ? '#22c55e' : 'var(--text-muted)',
            }}>
              {endpoint.isActive ? 'ATIVO' : 'PAUSADO'}
            </span>
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {endpoint.url}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <IconButton title="Testar" disabled={!!busy} onClick={handleTest}>
              {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </IconButton>
            <IconButton title={endpoint.isActive ? 'Pausar' : 'Ativar'} disabled={!!busy} onClick={handleToggle}>
              {busy === 'toggle' ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
            </IconButton>
            <IconButton title="Editar" disabled={!!busy} onClick={(e) => { e.stopPropagation(); onEdit() }}>
              ✎
            </IconButton>
            <IconButton title="Excluir" color="#ef4444" disabled={!!busy} onClick={handleDelete}>
              {busy === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </IconButton>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {endpoint.events.map(ev => (
          <span key={ev} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: 'var(--bg-surface)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}>
            {EVENT_LABELS[ev as WebhookEventType] ?? ev}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Criado {formatDate(endpoint.createdAt)} {endpoint.creator ? `por ${endpoint.creator.name}` : ''} · {endpoint._count?.deliveries ?? 0} entrega(s)
        </div>
        <button onClick={onView} style={{
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500,
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          Ver logs →
        </button>
      </div>
    </div>
  )
}

function IconButton({ children, color, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button {...props} style={{
      width: 28, height: 28, padding: 0,
      background: 'transparent', border: '1px solid var(--border)',
      borderRadius: 6, cursor: props.disabled ? 'not-allowed' : 'pointer',
      color: color ?? 'var(--text-secondary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, opacity: props.disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  )
}

// ─── Modal: criar / editar ──────────────────────────────────────

function CreateOrEditModal({ editing, onClose, onCreated }: {
  editing?: WebhookEndpoint
  onClose: () => void
  onCreated: (c: CreatedWebhook) => void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [url, setUrl] = useState(editing?.url ?? '')
  const [events, setEvents] = useState<WebhookEventType[]>(editing?.events ?? ['lead.created'])
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [showingSecret, setShowingSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleEvent(ev: WebhookEventType) {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Dê um nome pra esse webhook'); return }
    if (!url.trim()) { setError('URL é obrigatória'); return }
    if (events.length === 0) { setError('Selecione pelo menos um evento'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateWebhook(editing.id, { name: name.trim(), url: url.trim(), events })
        onCreated({ ...editing, name, url, events, secret: '' } as CreatedWebhook)
      } else {
        const created = await createWebhook({ name: name.trim(), url: url.trim(), events })
        onCreated(created)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao salvar')
      setSaving(false)
    }
  }

  async function handleRevealSecret() {
    if (!editing) return
    setShowingSecret(true)
    try {
      const s = await getWebhookSecret(editing.id)
      setRevealedSecret(s)
    } catch {
      alert('Erro ao buscar secret')
      setShowingSecret(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '92vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {editing ? 'Editar webhook' : 'Novo webhook'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome</label>
            <input value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder='Ex: "Sincroniza Mailchimp"' style={inputS} autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>URL de destino</label>
            <input value={url} onChange={e => { setUrl(e.target.value); setError('') }} placeholder="https://meu-sistema.com/webhooks/tribo" style={{ ...inputS, fontFamily: 'monospace', fontSize: 12 }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, margin: '6px 0 0' }}>
              Endpoint HTTP que receberá os POSTs. Precisa aceitar JSON e responder em até 5 segundos.
            </p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Eventos</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALL_EVENT_TYPES.map(ev => (
                <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', background: events.includes(ev) ? 'rgba(249,115,22,0.05)' : 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} style={{ accentColor: '#f97316' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{EVENT_LABELS[ev]}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ev}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {editing && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Secret</label>
              {revealedSecret ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={revealedSecret} readOnly onClick={e => (e.target as HTMLInputElement).select()} style={{ ...inputS, fontFamily: 'monospace', fontSize: 11 }} />
                  <CopyButton text={revealedSecret} />
                </div>
              ) : (
                <button onClick={handleRevealSecret} disabled={showingSecret} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={14} /> Mostrar secret
                </button>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, margin: '6px 0 0' }}>
                Use no validador HMAC-SHA256 do seu lado pra garantir autenticidade.
              </p>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} disabled={saving} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando...' : (editing ? 'Salvar' : 'Criar webhook')}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Modal: secret revelado pós-criação ─────────────────────────

function ShowSecretModal({ endpoint, onClose }: { endpoint: CreatedWebhook; onClose: () => void }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 540, maxWidth: '92vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Webhook size={18} color="#f97316" /> Webhook criado!
          </h2>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, padding: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, marginBottom: 16 }}>
            <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <strong>Anote o secret agora.</strong> Você vai precisar dele pra validar a assinatura dos webhooks no seu sistema. Se perder, depois é só revelar de novo na edição.
            </div>
          </div>

          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Secret</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={endpoint.secret} readOnly onClick={e => (e.target as HTMLInputElement).select()} style={{ ...inputS, fontFamily: 'monospace', fontSize: 11 }} />
            <CopyButton text={endpoint.secret} />
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Validação HMAC SHA-256: o TriboCRM envia o header <code style={{ background: 'var(--bg-surface)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>X-TriboCRM-Signature: sha256=&lt;hex&gt;</code>. No seu lado, recompute o HMAC do body recebido usando esse secret e confira se bate com a assinatura.
          </p>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            Já anotei, fechar
          </button>
        </div>
      </div>
    </>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handle() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <button onClick={handle} style={{
      background: copied ? '#22c55e' : 'var(--accent)', border: 'none',
      borderRadius: 8, padding: '0 14px', fontSize: 12, fontWeight: 600, color: '#fff',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

// ─── View: logs de um endpoint ──────────────────────────────────

function DeliveriesView({ endpoint, onBack }: { endpoint: WebhookEndpoint; onBack: () => void }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listDeliveries(endpoint.id)
      setDeliveries(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [endpoint.id])

  useEffect(() => { load() }, [load])

  async function handleResend(id: string) {
    setResending(id)
    try {
      await resendDelivery(id)
      // Wait a beat before reloading for the retry to populate
      setTimeout(load, 1500)
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Erro')
      setResending(null)
    } finally {
      setTimeout(() => setResending(null), 2000)
    }
  }

  return (
    <>
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 4, padding: 0,
      }}>
        <ChevronLeft size={16} /> Voltar
      </button>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{endpoint.name}</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>{endpoint.url}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Logs de entrega</h2>
        <button onClick={load} disabled={loading} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
        </div>
      ) : deliveries.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Nenhuma entrega ainda. Use o botão "Testar" pra disparar um payload de exemplo.
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Quando</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Evento</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>HTTP</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 500 }}>Tentativas</th>
                {canManage && <th style={{ width: 100 }} />}
              </tr>
            </thead>
            <tbody>
              {deliveries.map(d => (
                <tr key={d.id} style={{ borderTop: '1px solid var(--border)', fontSize: 12 }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{formatDate(d.createdAt)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 11 }}>{d.eventType}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                      background: d.status === 'SUCCESS' ? 'rgba(34,197,94,0.15)' : d.status === 'FAILED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: d.status === 'SUCCESS' ? '#22c55e' : d.status === 'FAILED' ? '#ef4444' : '#f59e0b',
                    }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }} title={d.lastError ?? d.lastResponseBody ?? ''}>
                    {d.lastResponseStatus ?? (d.lastError ? '—' : '—')}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{d.attemptCount}/3</td>
                  {canManage && (
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {d.status === 'FAILED' && (
                        <button onClick={() => handleResend(d.id)} disabled={resending === d.id} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {resending === d.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                          Reenviar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
