/**
 * Componente raiz do painel lateral do WhatsApp Web.
 *
 * ESTADOS:
 *   - 'loading'         → buscando info (lead por telefone, interações...)
 *   - 'unauthenticated' → usuário não está logado na extensão
 *   - 'no-chat'         → nenhuma conversa do WhatsApp está aberta
 *   - 'lead-found'      → lead encontrado, mostra dados + ações
 *   - 'lead-not-found'  → contato não cadastrado, mostra botão de criar
 *   - 'error'           → erro inesperado
 */

import { useEffect, useState, useCallback } from 'preact/hooks';
import type { Lead, Interaction, WhatsAppTemplate, Stage } from '@shared/types/domain';
import { sendMessage } from '@shared/utils/messaging';
import { normalizePhone } from '@shared/utils/phone';
import type { ChatInfo, WhatsAppContactInfo } from '../content/whatsapp-dom';
import {
  IconX,
  IconPlus,
  IconMessageCircle,
  IconUser,
  IconPhone
} from './icons';
import {
  formatRelativeTime,
  formatCurrency,
  interactionTypeLabel,
  temperatureLabel
} from './format';

type PanelState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'no-chat' }
  | { kind: 'manual-phone-input'; detectedName: string }
  | { kind: 'lead-found'; lead: Lead; interactions: Interaction[] }
  | { kind: 'lead-not-found'; contact: WhatsAppContactInfo }
  | { kind: 'error'; message: string };

type PanelProps = {
  chatInfo: ChatInfo;
  isOpen: boolean;
  onClose: () => void;
};

export function Panel({ chatInfo, isOpen, onClose }: PanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [toast, setToast] = useState<string | null>(null);
  // Telefone digitado manualmente, associado à chave da conversa atual.
  // Se a conversa muda, a associação "expira" automaticamente (deriva via chatKey).
  const [manualPhoneFor, setManualPhoneFor] = useState<
    { chatKey: string; phone: string } | null
  >(null);

  const chatKey =
    chatInfo.kind === 'detected'
      ? `phone:${chatInfo.contact.phone}`
      : chatInfo.kind === 'needs-phone'
      ? `name:${chatInfo.detectedName}`
      : 'none';

  const manualPhone =
    manualPhoneFor?.chatKey === chatKey ? manualPhoneFor.phone : null;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // Recarrega quando a conversa muda
  const reload = useCallback(async () => {
    setState({ kind: 'loading' });

    // Valida auth primeiro
    try {
      const auth = await sendMessage({ type: 'AUTH_GET_STATE' });
      if (!auth.isAuthenticated) {
        setState({ kind: 'unauthenticated' });
        return;
      }
    } catch (err) {
      setState({ kind: 'error', message: 'Não foi possível verificar sessão' });
      return;
    }

    // Determina o "contato efetivo": manual tem prioridade sobre detectado.
    let effectiveContact: WhatsAppContactInfo | null = null;
    if (manualPhone) {
      const displayName =
        chatInfo.kind === 'detected'
          ? chatInfo.contact.displayName
          : chatInfo.kind === 'needs-phone'
          ? chatInfo.detectedName
          : manualPhone;
      effectiveContact = { displayName, phone: manualPhone };
    } else if (chatInfo.kind === 'detected') {
      effectiveContact = chatInfo.contact;
    } else if (chatInfo.kind === 'needs-phone') {
      setState({ kind: 'manual-phone-input', detectedName: chatInfo.detectedName });
      return;
    }

    if (!effectiveContact) {
      setState({ kind: 'no-chat' });
      return;
    }

    try {
      const lead = await sendMessage({
        type: 'LEAD_FIND_BY_PHONE',
        payload: { phone: effectiveContact.phone }
      });

      if (!lead) {
        setState({ kind: 'lead-not-found', contact: effectiveContact });
        return;
      }

      const interactions = await sendMessage({
        type: 'INTERACTION_LIST',
        payload: { leadId: lead.id }
      });

      setState({ kind: 'lead-found', lead, interactions });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar lead';
      setState({ kind: 'error', message });
    }
  }, [chatInfo, manualPhone]);

  useEffect(() => {
    if (isOpen) reload();
  }, [chatKey, manualPhone, isOpen, reload]);

  const handleManualPhoneSubmit = useCallback(
    (phone: string) => {
      setManualPhoneFor({ chatKey, phone });
    },
    [chatKey]
  );

  return (
    <div class={`tribocrm-panel-root ${isOpen ? 'tribocrm-open' : ''}`}>
      <div class="tribocrm-header">
        <span class="tribocrm-logo">
          <span class="tribocrm-logo-tribo">Tribo</span>
          <span class="tribocrm-logo-crm">CRM</span>
        </span>
        <button class="tribocrm-close-btn" onClick={onClose} title="Fechar">
          <IconX size={18} />
        </button>
      </div>

      <div class="tribocrm-body">
        {state.kind === 'loading' && <LoadingState />}
        {state.kind === 'unauthenticated' && <UnauthenticatedState />}
        {state.kind === 'no-chat' && <NoChatState />}
        {state.kind === 'error' && <ErrorState message={state.message} />}
        {state.kind === 'manual-phone-input' && (
          <ManualPhoneInputView
            detectedName={state.detectedName}
            onSubmit={handleManualPhoneSubmit}
          />
        )}
        {state.kind === 'lead-found' && (
          <LeadFoundView
            lead={state.lead}
            interactions={state.interactions}
            onUpdate={reload}
            onToast={showToast}
          />
        )}
        {state.kind === 'lead-not-found' && (
          <LeadNotFoundView contact={state.contact} onCreated={reload} onToast={showToast} />
        )}
      </div>

      {toast && <div class="tribocrm-toast">{toast}</div>}
    </div>
  );
}

// ── Estados simples ───────────────────────────────────────────

function LoadingState() {
  return (
    <div class="tribocrm-loading">
      <div class="tribocrm-spinner" />
      <div>Carregando...</div>
    </div>
  );
}

function UnauthenticatedState() {
  return (
    <div class="tribocrm-auth-prompt">
      <div class="tribocrm-empty-icon">
        <IconUser size={24} />
      </div>
      <h3>Entre no TriboCRM</h3>
      <p>Clique no ícone do TriboCRM na barra do Chrome para fazer login.</p>
    </div>
  );
}

function NoChatState() {
  return (
    <div class="tribocrm-empty">
      <div class="tribocrm-empty-icon">
        <IconMessageCircle size={24} />
      </div>
      <div>Abra uma conversa para ver os dados do lead.</div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div class="tribocrm-empty">
      <div class="tribocrm-error-banner">{message}</div>
    </div>
  );
}

function ManualPhoneInputView({
  detectedName,
  onSubmit
}: {
  detectedName: string;
  onSubmit: (phone: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: Event) {
    e.preventDefault();
    const normalized = normalizePhone(value);
    if (!normalized) {
      setError('Número inválido. Use o formato +55 (11) 91234-5678.');
      return;
    }
    setError(null);
    onSubmit(normalized);
  }

  return (
    <div class="tribocrm-manual-phone">
      <div class="tribocrm-empty-icon">
        <IconPhone size={24} />
      </div>
      <div class="tribocrm-manual-phone-title">
        Não consegui identificar o número automaticamente.
      </div>
      <div class="tribocrm-manual-phone-subtext">Contato detectado</div>
      <div class="tribocrm-manual-phone-name">{detectedName}</div>
      <form class="tribocrm-manual-phone-form" onSubmit={submit}>
        {error && <div class="tribocrm-error-banner">{error}</div>}
        <div class="tribocrm-field">
          <label class="tribocrm-field-label">Número do contato</label>
          <input
            class="tribocrm-input"
            type="tel"
            value={value}
            onInput={(e) => setValue((e.target as HTMLInputElement).value)}
            placeholder="+55 (11) 91234-5678"
            autofocus
          />
        </div>
        <button
          type="submit"
          class="tribocrm-btn tribocrm-btn-primary tribocrm-btn-full"
          disabled={!value.trim()}
        >
          Buscar no TriboCRM
        </button>
      </form>
    </div>
  );
}

// ── Visão de lead encontrado ──────────────────────────────────

type LeadFoundProps = {
  lead: Lead;
  interactions: Interaction[];
  onUpdate: () => void;
  onToast: (msg: string) => void;
};

function LeadFoundView({ lead, interactions, onUpdate, onToast }: LeadFoundProps) {
  const [mode, setMode] = useState<'view' | 'interaction' | 'templates' | 'stage'>('view');

  return (
    <>
      {/* Card com dados do lead */}
      <div class="tribocrm-lead-card">
        <div class="tribocrm-lead-header">
          <div>
            <h3 class="tribocrm-lead-name">{lead.name}</h3>
            {lead.company && <div class="tribocrm-lead-company">{lead.company}</div>}
          </div>
          <TemperatureBadge temperature={lead.temperature} />
        </div>
        <div class="tribocrm-lead-meta">
          <div>
            <div class="tribocrm-meta-label">Etapa</div>
            <div class="tribocrm-meta-value">
              <span class="tribocrm-stage-pill">{lead.stage.name}</span>
            </div>
          </div>
          <div>
            <div class="tribocrm-meta-label">Valor esperado</div>
            <div class="tribocrm-meta-value">{formatCurrency(lead.expectedValue)}</div>
          </div>
          <div>
            <div class="tribocrm-meta-label">Responsável</div>
            <div class="tribocrm-meta-value">{lead.responsible.name}</div>
          </div>
          <div>
            <div class="tribocrm-meta-label">Pipeline</div>
            <div class="tribocrm-meta-value">{lead.pipeline.name}</div>
          </div>
        </div>
      </div>

      {/* Ações principais */}
      {mode === 'view' && (
        <>
          <div class="tribocrm-btn-group">
            <button class="tribocrm-btn tribocrm-btn-primary" onClick={() => setMode('interaction')}>
              <IconPlus size={14} /> Interação
            </button>
            <button class="tribocrm-btn tribocrm-btn-ghost" onClick={() => setMode('stage')}>
              Mudar etapa
            </button>
          </div>
          <div style={{ height: 8 }} />
          <button
            class="tribocrm-btn tribocrm-btn-ghost tribocrm-btn-full"
            onClick={() => setMode('templates')}
          >
            <IconMessageCircle size={14} /> Modelos de mensagem
          </button>

          {/* Timeline */}
          <div class="tribocrm-section" style={{ marginTop: 20 }}>
            <div class="tribocrm-section-title">Histórico</div>
            {interactions.length === 0 ? (
              <div class="tribocrm-interaction">
                <div class="tribocrm-interaction-body" style={{ color: 'var(--tribocrm-text-muted)' }}>
                  Nenhuma interação registrada ainda.
                </div>
              </div>
            ) : (
              <div class="tribocrm-timeline">
                {interactions.map((int) => (
                  <div class="tribocrm-interaction" key={int.id}>
                    <div class="tribocrm-interaction-head">
                      <span class="tribocrm-interaction-type">
                        {interactionTypeLabel(int.type)}
                      </span>
                      <span class="tribocrm-interaction-date">
                        {formatRelativeTime(int.createdAt)}
                      </span>
                    </div>
                    <div class="tribocrm-interaction-body">{int.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'interaction' && (
        <InteractionForm
          leadId={lead.id}
          onCancel={() => setMode('view')}
          onSaved={() => {
            onToast('Interação registrada');
            setMode('view');
            onUpdate();
          }}
        />
      )}

      {mode === 'stage' && (
        <StageForm
          lead={lead}
          onCancel={() => setMode('view')}
          onSaved={() => {
            onToast('Etapa atualizada');
            setMode('view');
            onUpdate();
          }}
        />
      )}

      {mode === 'templates' && (
        <TemplatesList
          leadName={lead.name}
          phone={lead.phone ?? lead.whatsapp ?? ''}
          onCancel={() => setMode('view')}
          onSent={() => {
            onToast('Mensagem pronta no WhatsApp');
            setMode('view');
          }}
        />
      )}
    </>
  );
}

function TemperatureBadge({ temperature }: { temperature: string }) {
  const icon = temperature === 'HOT' ? '🔥' : temperature === 'WARM' ? '🌤' : '❄️';
  const cls =
    temperature === 'HOT'
      ? 'tribocrm-temp-hot'
      : temperature === 'WARM'
      ? 'tribocrm-temp-warm'
      : 'tribocrm-temp-cold';
  return (
    <span class={`tribocrm-temp-badge ${cls}`}>
      <span>{icon}</span>
      <span>{temperatureLabel(temperature)}</span>
    </span>
  );
}

// ── Form: registrar interação ────────────────────────────────

function InteractionForm({
  leadId,
  onCancel,
  onSaved
}: {
  leadId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<Interaction['type']>('WHATSAPP');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await sendMessage({
        type: 'INTERACTION_CREATE',
        payload: { leadId, type, description: description.trim() }
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div class="tribocrm-section-title">Nova interação</div>
      {error && <div class="tribocrm-error-banner">{error}</div>}

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Tipo</label>
        <select
          class="tribocrm-select"
          value={type}
          onChange={(e) => setType((e.target as HTMLSelectElement).value as Interaction['type'])}
        >
          <option value="WHATSAPP">WhatsApp</option>
          <option value="CALL">Ligação</option>
          <option value="EMAIL">E-mail</option>
          <option value="MEETING">Reunião</option>
          <option value="NOTE">Anotação</option>
          <option value="VISIT">Visita</option>
        </select>
      </div>

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Descrição</label>
        <textarea
          class="tribocrm-textarea"
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          placeholder="O que foi conversado..."
          required
        />
      </div>

      <div class="tribocrm-btn-group">
        <button
          type="button"
          class="tribocrm-btn tribocrm-btn-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="tribocrm-btn tribocrm-btn-primary"
          disabled={saving || !description.trim()}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

// ── Form: mudar etapa ────────────────────────────────────────

function StageForm({
  lead,
  onCancel,
  onSaved
}: {
  lead: Lead;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [selected, setSelected] = useState<string>(lead.stage.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sendMessage({ type: 'STAGE_LIST', payload: { pipelineId: lead.pipeline.id } })
      .then(setStages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar etapas'));
  }, [lead.pipeline.id]);

  async function submit(e: Event) {
    e.preventDefault();
    if (selected === lead.stage.id) {
      onCancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await sendMessage({
        type: 'LEAD_UPDATE_STAGE',
        payload: { leadId: lead.id, stageId: selected }
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mudar etapa');
    } finally {
      setSaving(false);
    }
  }

  if (!stages && !error) {
    return <div class="tribocrm-loading"><div class="tribocrm-spinner" /></div>;
  }

  return (
    <form onSubmit={submit}>
      <div class="tribocrm-section-title">Mudar etapa</div>
      {error && <div class="tribocrm-error-banner">{error}</div>}

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Nova etapa</label>
        <select
          class="tribocrm-select"
          value={selected}
          onChange={(e) => setSelected((e.target as HTMLSelectElement).value)}
        >
          {stages?.map((s) => (
            <option value={s.id} key={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div class="tribocrm-btn-group">
        <button
          type="button"
          class="tribocrm-btn tribocrm-btn-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="tribocrm-btn tribocrm-btn-primary"
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Atualizar'}
        </button>
      </div>
    </form>
  );
}

// ── Lista de templates ────────────────────────────────────────

function TemplatesList({
  leadName,
  phone,
  onCancel,
  onSent
}: {
  leadName: string;
  phone: string;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sendMessage({ type: 'TEMPLATE_LIST' })
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'));
  }, []);

  function useTemplate(t: WhatsAppTemplate) {
    // Substitui variáveis básicas
    const body = t.body
      .replace(/\{\{nome_lead\}\}/g, leadName.split(' ')[0])
      .replace(/\{\{nome_vendedor\}\}/g, '')
      .replace(/\{\{nome_empresa\}\}/g, '');

    // Abre WhatsApp com a mensagem pré-preenchida.
    // Obs: esta é a forma mais confiável — o próprio WhatsApp Web reconhece
    // a URL e cola a mensagem no campo. Injetar direto no DOM é frágil.
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(body)}`;
    window.open(url, '_self');
    onSent();
  }

  if (error) return <div class="tribocrm-error-banner">{error}</div>;
  if (!templates) return <div class="tribocrm-loading"><div class="tribocrm-spinner" /></div>;

  return (
    <div>
      <div class="tribocrm-section-title">Modelos</div>
      {templates.length === 0 ? (
        <div class="tribocrm-empty">Nenhum modelo configurado ainda.</div>
      ) : (
        templates.map((t) => (
          <div
            class="tribocrm-template-item"
            key={t.id}
            onClick={() => useTemplate(t)}
            role="button"
          >
            <div class="tribocrm-template-name">{t.name}</div>
            <div class="tribocrm-template-preview">{t.body}</div>
          </div>
        ))
      )}
      <button
        class="tribocrm-btn tribocrm-btn-ghost tribocrm-btn-full"
        style={{ marginTop: 8 }}
        onClick={onCancel}
      >
        Voltar
      </button>
    </div>
  );
}

// ── Visão: lead não encontrado ────────────────────────────────

function LeadNotFoundView({
  contact,
  onCreated,
  onToast
}: {
  contact: WhatsAppContactInfo;
  onCreated: () => void;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(contact.displayName);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await sendMessage({
        type: 'LEAD_CREATE',
        payload: {
          name: name.trim(),
          phone: contact.phone,
          whatsapp: contact.phone,
          email: email.trim() || undefined,
          company: company.trim() || undefined
        }
      });
      onToast('Lead cadastrado!');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  }

  if (!showForm) {
    return (
      <div class="tribocrm-empty">
        <div class="tribocrm-empty-icon">
          <IconUser size={24} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ color: 'var(--tribocrm-text-primary)' }}>{contact.displayName}</strong>
          <br />
          <span>ainda não está cadastrado.</span>
        </div>
        <button
          class="tribocrm-btn tribocrm-btn-primary"
          onClick={() => setShowForm(true)}
        >
          <IconPlus size={14} /> Cadastrar como lead
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div class="tribocrm-section-title">Novo lead</div>
      {error && <div class="tribocrm-error-banner">{error}</div>}

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Nome *</label>
        <input
          class="tribocrm-input"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          required
        />
      </div>

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">WhatsApp</label>
        <input class="tribocrm-input" value={`+${contact.phone}`} disabled />
      </div>

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">E-mail</label>
        <input
          class="tribocrm-input"
          type="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Empresa</label>
        <input
          class="tribocrm-input"
          value={company}
          onInput={(e) => setCompany((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="tribocrm-btn-group">
        <button
          type="button"
          class="tribocrm-btn tribocrm-btn-ghost"
          onClick={() => setShowForm(false)}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="tribocrm-btn tribocrm-btn-primary"
          disabled={saving || !name.trim()}
        >
          {saving ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
