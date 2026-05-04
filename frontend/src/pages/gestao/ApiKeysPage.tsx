import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Copy, Check, Loader2, KeyRound, AlertTriangle, X } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { listApiKeys, createApiKey, revokeApiKey, type ApiKey, type CreatedApiKey } from '../../services/apiKeys.service'

/**
 * Tela de gestão das API keys do tenant. Acessível em
 * /gestao/configuracoes/api por OWNER/MANAGER (criar/revogar) e demais
 * roles em modo somente-leitura (gate é no backend; UI esconde os
 * botões de acordo com role local pra UX).
 *
 * Fluxo de criação: clica "Nova key" → digita nome → backend retorna
 * a key em texto plano UMA ÚNICA VEZ → modal de "copie agora ou perderá".
 * Depois disso, só o prefixo (tcrm_live_abc...) fica visível.
 */

const ROLE = (() => {
  try {
    return (JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string }).role ?? ''
  } catch {
    return ''
  }
})()

const canManage = ROLE === 'OWNER' || ROLE === 'MANAGER'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listApiKeys()
      setKeys(data)
      setError('')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao carregar API keys')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRevoke(id: string) {
    if (!confirm('Tem certeza que quer revogar essa API key? Quem usa ela vai perder acesso imediatamente.')) return
    setRevokingId(id)
    try {
      await revokeApiKey(id)
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Erro ao revogar')
    } finally {
      setRevokingId(null)
    }
  }

  const activeKeys = keys.filter(k => !k.revokedAt)
  const revokedKeys = keys.filter(k => k.revokedAt)

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>API Keys</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
            Chaves de integração com a API pública do TriboCRM (v1).
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setCreateModal(true)}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 8,
              padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={16} strokeWidth={2.5} /> Nova key
          </button>
        )}
      </div>

      {/* Info card */}
      <div style={{ ...card, padding: 16, marginBottom: 20, display: 'flex', gap: 12 }}>
        <KeyRound size={18} color="#f97316" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Cada key permite que sistemas externos (formulários, automações, integrações) criem e consultem leads no seu CRM. Trate como senha — não compartilhe e não comite em código aberto.
          <br />
          Documentação completa em <a href="https://docs.tribocrm.com.br/api" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>docs.tribocrm.com.br/api</a>.
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
      ) : (
        <>
          {/* Active */}
          <div style={{ ...card, marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Keys ativas ({activeKeys.length})
            </div>
            {activeKeys.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nenhuma key ativa. {canManage ? 'Clique em "Nova key" pra criar a primeira.' : ''}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 20px', fontWeight: 500 }}>Nome</th>
                    <th style={{ textAlign: 'left', padding: '10px 20px', fontWeight: 500 }}>Prefixo</th>
                    <th style={{ textAlign: 'left', padding: '10px 20px', fontWeight: 500 }}>Criada em</th>
                    <th style={{ textAlign: 'left', padding: '10px 20px', fontWeight: 500 }}>Último uso</th>
                    <th style={{ textAlign: 'left', padding: '10px 20px', fontWeight: 500 }}>Criada por</th>
                    {canManage && <th style={{ width: 60 }} />}
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map(k => (
                    <tr key={k.id} style={{ borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 500 }}>{k.name}</td>
                      <td style={{ padding: '12px 20px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{k.keyPrefix}…</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{formatDate(k.createdAt)}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{formatDate(k.lastUsedAt)}</td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{k.creator?.name ?? '—'}</td>
                      {canManage && (
                        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleRevoke(k.id)}
                            disabled={revokingId === k.id}
                            title="Revogar"
                            style={{ background: 'transparent', border: 'none', cursor: revokingId === k.id ? 'not-allowed' : 'pointer', color: '#ef4444', padding: 4, opacity: revokingId === k.id ? 0.5 : 1 }}
                          >
                            {revokingId === k.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Revoked */}
          {revokedKeys.length > 0 && (
            <div style={card}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Keys revogadas ({revokedKeys.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {revokedKeys.map(k => (
                    <tr key={k.id} style={{ borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', opacity: 0.65 }}>
                      <td style={{ padding: '12px 20px', fontWeight: 500 }}>{k.name}</td>
                      <td style={{ padding: '12px 20px', fontFamily: 'monospace' }}>{k.keyPrefix}…</td>
                      <td style={{ padding: '12px 20px' }}>Revogada em {formatDate(k.revokedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {createModal && (
        <CreateKeyModal
          onClose={() => setCreateModal(false)}
          onCreated={(created) => {
            setCreateModal(false)
            setCreatedKey(created)
            load()
          }}
        />
      )}

      {createdKey && (
        <ShowKeyModal apiKey={createdKey} onClose={() => setCreatedKey(null)} />
      )}
    </AppLayout>
  )
}

// ─── Modal: criar nova key ──────────────────────────────────────

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (key: CreatedApiKey) => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Dê um nome pra essa key (ex: "Site institucional", "Zapier")'); return }
    setSaving(true)
    setError('')
    try {
      const created = await createApiKey(name.trim())
      onCreated(created)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Erro ao criar key')
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nova API key</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nome da key</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder='Ex: "Site institucional", "Zapier"'
            autoFocus
            style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, margin: '6px 0 0' }}>
            Use um nome que ajude a lembrar onde a key está sendo usada.
          </p>
          {error && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} disabled={saving} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancelar</button>
          <button onClick={handleCreate} disabled={saving || !name.trim()} style={{ background: name.trim() ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: name.trim() ? '#fff' : 'var(--text-muted)', cursor: name.trim() && !saving ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Criando...' : 'Criar key'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Modal: mostrar key recém-criada (única vez) ────────────────

function ShowKeyModal({ apiKey, onClose }: { apiKey: CreatedApiKey; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(apiKey.key).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '90vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 61 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={18} color="#f97316" /> Sua nova API key
          </h2>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, padding: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, marginBottom: 16 }}>
            <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <strong>Copie agora.</strong> Por segurança, essa é a única vez que você vai ver a key inteira. Depois desse momento só o prefixo fica visível.
            </div>
          </div>

          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>API key — {apiKey.name}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={apiKey.key}
              readOnly
              onClick={e => (e.target as HTMLInputElement).select()}
              style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)', outline: 'none' }}
            />
            <button
              onClick={handleCopy}
              style={{ background: copied ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiada!' : 'Copiar'}
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 }}>
            Use no header das requisições da API:<br />
            <code style={{ display: 'inline-block', marginTop: 4, padding: '4px 8px', background: 'var(--bg-surface)', borderRadius: 4, fontSize: 11 }}>
              Authorization: Bearer {apiKey.key.slice(0, 16)}…
            </code>
          </p>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            Já copiei, fechar
          </button>
        </div>
      </div>
    </>
  )
}
