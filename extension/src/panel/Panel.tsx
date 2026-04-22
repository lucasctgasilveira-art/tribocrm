/**
 * Componente raiz do painel lateral do WhatsApp Web.
 *
 * ESTADOS:
 *   - 'loading'         → buscando info (lead por telefone, interações...)
 *   - 'unauthenticated' → usuário não está logado na extensão
 *   - 'onboarding'      → aceite de Termos/Privacidade pendente (ou versão mudou)
 *   - 'no-chat'         → nenhuma conversa do WhatsApp está aberta
 *   - 'lead-found'      → lead encontrado, mostra dados + ações
 *   - 'lead-not-found'  → contato não cadastrado, mostra botão de criar
 *   - 'error'           → erro inesperado
 */

import { useEffect, useState, useCallback, useRef } from 'preact/hooks';
import type { Lead, Interaction, WhatsAppTemplate, Stage } from '@shared/types/domain';
import type { Product, LeadProduct } from '@shared/types/extra';
import { sendMessage } from '@shared/utils/messaging';
import { normalizePhone } from '@shared/utils/phone';
import {
  type Theme,
  getInitialTheme,
  setTheme as persistTheme,
  applyTheme
} from '@shared/utils/theme';
import {
  CURRENT_VERSION as ONBOARDING_VERSION,
  TERMS_URL,
  PRIVACY_URL,
  hasAcceptedCurrentVersion,
  setAcceptedVersion
} from '@shared/utils/onboarding';
import type { ChatInfo, WhatsAppContactInfo } from '../content/whatsapp-dom';
import {
  IconX,
  IconPlus,
  IconMessageCircle,
  IconUser,
  IconPhone,
  IconSun,
  IconMoon,
  IconAlertTriangle,
  IconCalendar
} from './icons';
import {
  formatRelativeTime,
  formatCurrency,
  formatCurrencyExact,
  interactionTypeLabel,
  temperatureLabel
} from './format';
import { renderTemplate } from '@shared/utils/templates';
import { injectTextIntoChat } from '../content/whatsapp-input';

const MOCK_MODE = import.meta.env.VITE_USE_MOCKS === 'true';

type PanelState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'onboarding' }
  | { kind: 'no-chat' }
  | { kind: 'manual-phone-input'; detectedName: string }
  | { kind: 'lead-found'; lead: Lead; interactions: Interaction[] }
  | { kind: 'lead-not-found'; contact: WhatsAppContactInfo }
  | { kind: 'error'; message: string };

type PanelProps = {
  chatInfo: ChatInfo;
  isOpen: boolean;
  isNarrow: boolean;
  onClose: () => void;
};

export function Panel({ chatInfo, isOpen, isNarrow, onClose }: PanelProps) {
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

  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    let cancelled = false;
    getInitialTheme().then((initial) => {
      if (cancelled) return;
      setThemeState(initial);
      const root = document.getElementById('tribocrm-panel-mount') ?? document.documentElement;
      applyTheme(initial, root);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      const root = document.getElementById('tribocrm-panel-mount') ?? document.documentElement;
      applyTheme(next, root);
      void persistTheme(next);
      return next;
    });
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

    // Valida aceite de Termos/Privacidade (LGPD). Falha de storage = trata
    // como não aceito — fail-safe: melhor pedir aceite de novo do que
    // assumir consentimento que pode não existir.
    try {
      const accepted = await hasAcceptedCurrentVersion();
      if (!accepted) {
        setState({ kind: 'onboarding' });
        return;
      }
    } catch {
      setState({ kind: 'onboarding' });
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
    if (isOpen && !isNarrow) reload();
  }, [chatKey, manualPhone, isOpen, isNarrow, reload]);

  const handleManualPhoneSubmit = useCallback(
    (phone: string) => {
      setManualPhoneFor({ chatKey, phone });
    },
    [chatKey]
  );

  return (
    <div class="tribocrm-panel-root">
      <div class="tribocrm-header">
        <span class="tribocrm-logo">
          <span class="tribocrm-logo-tribo">Tribo</span>
          <span class="tribocrm-logo-crm">CRM</span>
        </span>
        <div class="tribocrm-header-actions">
          <button
            class="tribocrm-header-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
          <button class="tribocrm-header-btn" onClick={onClose} title="Fechar">
            <IconX size={18} />
          </button>
        </div>
      </div>

      {MOCK_MODE && <MockModeBanner />}

      <div class="tribocrm-body">
        {isNarrow ? (
          <ViewportTooNarrowState />
        ) : (
          <>
            {state.kind === 'loading' && <LoadingState />}
            {state.kind === 'unauthenticated' && <UnauthenticatedState />}
            {state.kind === 'onboarding' && <OnboardingView onAccept={reload} />}
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
          </>
        )}
      </div>

      {toast && !isNarrow && <div class="tribocrm-toast">{toast}</div>}
    </div>
  );
}

// ── Estados simples ───────────────────────────────────────────

function MockModeBanner() {
  return (
    <div class="tribocrm-mock-banner">
      <IconAlertTriangle size={14} />
      <span>MODO DESENVOLVIMENTO — dados fictícios</span>
    </div>
  );
}

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

function OnboardingView({ onAccept }: { onAccept: () => void }) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!acceptTerms || !acceptPrivacy || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setAcceptedVersion(ONBOARDING_VERSION);
      onAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar aceite');
      setSaving(false);
    }
  }

  return (
    <div class="tribocrm-onboarding">
      <h2 class="tribocrm-onboarding-title">Bem-vindo ao TriboCRM</h2>
      <p class="tribocrm-onboarding-intro">
        O TriboCRM integra seu WhatsApp Web, LinkedIn e Gmail ao seu CRM,
        permitindo registrar leads e interações sem sair dessas plataformas.
      </p>
      {error && <div class="tribocrm-error-banner">{error}</div>}
      <div class="tribocrm-onboarding-terms">
        <label class="tribocrm-onboarding-check">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms((e.target as HTMLInputElement).checked)}
          />
          <span>
            Li e aceito os{' '}
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
              Termos de Uso
            </a>
          </span>
        </label>
        <label class="tribocrm-onboarding-check">
          <input
            type="checkbox"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy((e.target as HTMLInputElement).checked)}
          />
          <span>
            Consinto com a coleta e processamento dos meus dados e dos
            contatos com quem interajo, conforme a{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Política de Privacidade
            </a>
          </span>
        </label>
      </div>
      <button
        class="tribocrm-btn tribocrm-btn-primary tribocrm-btn-full"
        disabled={!acceptTerms || !acceptPrivacy || saving}
        onClick={handleAccept}
      >
        {saving ? 'Salvando...' : 'Começar'}
      </button>
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

function ViewportTooNarrowState() {
  return (
    <div class="tribocrm-empty">
      <div class="tribocrm-empty-icon">
        <IconAlertTriangle size={24} />
      </div>
      <div>Amplie a janela para usar o TriboCRM.</div>
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

type Tab = 'dados' | 'notas' | 'tarefas' | 'produtos' | 'historico';

function LeadFoundView({ lead, interactions, onUpdate, onToast }: LeadFoundProps) {
  const [tab, setTab] = useState<Tab>('dados');

  return (
    <>
      <div class="tribocrm-lead-mini">
        <div class="tribocrm-lead-mini-info">
          <h3 class="tribocrm-lead-name">{lead.name}</h3>
          {lead.company && <div class="tribocrm-lead-company">{lead.company}</div>}
        </div>
        <TemperatureBadge temperature={lead.temperature} />
      </div>

      <TabsBar active={tab} onChange={setTab} />

      {tab === 'dados' && (
        <DadosTab lead={lead} onUpdate={onUpdate} onToast={onToast} />
      )}
      {tab === 'notas' && <NotesTab leadId={lead.id} onToast={onToast} />}
      {tab === 'tarefas' && <TasksPlaceholder />}
      {tab === 'produtos' && <ProductsTab leadId={lead.id} onToast={onToast} />}
      {tab === 'historico' && <HistoricoTab interactions={interactions} />}
    </>
  );
}

function TabsBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'dados', label: 'Dados' },
    { id: 'notas', label: 'Notas' },
    { id: 'tarefas', label: 'Tarefas' },
    { id: 'produtos', label: 'Produtos' },
    { id: 'historico', label: 'Histórico' }
  ];

  return (
    <div class="tribocrm-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={active === t.id}
          class={`tribocrm-tab ${active === t.id ? 'tribocrm-tab-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function DadosTab({
  lead,
  onUpdate,
  onToast
}: {
  lead: Lead;
  onUpdate: () => void;
  onToast: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'interaction' | 'templates' | 'stage'>('view');

  return (
    <>
      <div class="tribocrm-lead-card">
        <div class="tribocrm-lead-meta tribocrm-lead-meta-no-border">
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

      {mode === 'view' && (
        <>
          <div class="tribocrm-btn-group">
            <button
              class="tribocrm-btn tribocrm-btn-primary"
              onClick={() => setMode('interaction')}
            >
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
        <TemplatesList lead={lead} onClose={() => setMode('view')} onToast={onToast} />
      )}
    </>
  );
}

function HistoricoTab({ interactions }: { interactions: Interaction[] }) {
  if (interactions.length === 0) {
    return (
      <div class="tribocrm-interaction">
        <div
          class="tribocrm-interaction-body"
          style={{ color: 'var(--tribocrm-text-muted)' }}
        >
          Nenhuma interação registrada ainda.
        </div>
      </div>
    );
  }

  return (
    <div class="tribocrm-timeline">
      {interactions.map((int) => (
        <div class="tribocrm-interaction" key={int.id}>
          <div class="tribocrm-interaction-head">
            <span class="tribocrm-interaction-type">{interactionTypeLabel(int.type)}</span>
            <span class="tribocrm-interaction-date">
              {formatRelativeTime(int.createdAt)}
            </span>
          </div>
          <div class="tribocrm-interaction-body">{int.description}</div>
        </div>
      ))}
    </div>
  );
}

function TasksPlaceholder() {
  return (
    <div class="tribocrm-empty">
      <div class="tribocrm-empty-icon">
        <IconCalendar size={24} />
      </div>
      <div>Em breve.</div>
    </div>
  );
}

// ── Aba Notas ──────────────────────────────────────────────────

type NotesStatus =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'typing' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error' };

function NotesTab({ leadId, onToast }: { leadId: string; onToast: (m: string) => void }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<NotesStatus>({ kind: 'loading' });

  const timeoutRef = useRef<number | null>(null);
  const lastSavedRef = useRef('');
  const dirtyRef = useRef(false);
  const textRef = useRef('');
  // Tick para "Salvo há X" atualizar visualmente
  const [, setNow] = useState(0);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: 'loading' });
    sendMessage({ type: 'NOTES_GET', payload: { leadId } })
      .then((val) => {
        if (cancelled) return;
        setText(val);
        textRef.current = val;
        lastSavedRef.current = val;
        dirtyRef.current = false;
        setStatus({ kind: 'idle' });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({ kind: 'error' });
        onToast(err instanceof Error ? err.message : 'Erro ao carregar anotações');
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function flush() {
    if (!dirtyRef.current) return;
    const snapshot = textRef.current;
    setStatus({ kind: 'saving' });
    try {
      await sendMessage({ type: 'NOTES_SET', payload: { leadId, text: snapshot } });
      lastSavedRef.current = snapshot;
      const stillDirty = textRef.current !== lastSavedRef.current;
      dirtyRef.current = stillDirty;
      setStatus(stillDirty ? { kind: 'typing' } : { kind: 'saved', at: Date.now() });
    } catch {
      setStatus({ kind: 'error' });
    }
  }

  function onInput(e: Event) {
    const v = (e.target as HTMLTextAreaElement).value;
    setText(v);
    textRef.current = v;
    dirtyRef.current = v !== lastSavedRef.current;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!dirtyRef.current) {
      setStatus(
        lastSavedRef.current === '' ? { kind: 'idle' } : { kind: 'saved', at: Date.now() }
      );
      return;
    }

    setStatus({ kind: 'typing' });
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      void flush();
    }, 1000);
  }

  // Cleanup: ao trocar lead ou desmontar, flush pendente
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (dirtyRef.current) {
        void sendMessage({
          type: 'NOTES_SET',
          payload: { leadId, text: textRef.current }
        });
      }
    };
  }, [leadId]);

  // Re-render a cada 30s pra atualizar "Salvo há X"
  useEffect(() => {
    if (status.kind !== 'saved') return;
    const id = window.setInterval(() => setNow((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [status.kind]);

  function statusLabel(): string {
    switch (status.kind) {
      case 'loading':
        return 'Carregando...';
      case 'idle':
        return '';
      case 'typing':
        return 'Digitando...';
      case 'saving':
        return 'Salvando...';
      case 'saved':
        return `Salvo ${formatRelativeTime(new Date(status.at).toISOString())}`;
      case 'error':
        return 'Erro ao salvar';
    }
  }

  return (
    <div class="tribocrm-notes">
      <textarea
        class="tribocrm-textarea tribocrm-notes-textarea"
        value={text}
        onInput={onInput}
        placeholder="Escreva anotações sobre este lead..."
        disabled={status.kind === 'loading'}
      />
      <div
        class={`tribocrm-notes-status ${
          status.kind === 'error' ? 'tribocrm-notes-status-error' : ''
        }`}
      >
        {statusLabel()}
      </div>
    </div>
  );
}

// ── Aba Produtos ───────────────────────────────────────────────

function ProductsTab({
  leadId,
  onToast
}: {
  leadId: string;
  onToast: (m: string) => void;
}) {
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [items, setItems] = useState<LeadProduct[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const itemsRef = useRef<LeadProduct[]>([]);

  useEffect(() => {
    if (items) itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      sendMessage({ type: 'PRODUCTS_CATALOG' }),
      sendMessage({ type: 'PRODUCTS_GET_FOR_LEAD', payload: { leadId } })
    ])
      .then(([cat, leadItems]) => {
        if (cancelled) return;
        setCatalog(cat);
        setItems(leadItems);
        itemsRef.current = leadItems;
      })
      .catch((err) => {
        if (cancelled) return;
        onToast(err instanceof Error ? err.message : 'Erro ao carregar produtos');
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Cleanup: flush pending edit on unmount/leadId change
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        if (dirtyRef.current) {
          void sendMessage({
            type: 'PRODUCTS_SET_FOR_LEAD',
            payload: { leadId, items: itemsRef.current }
          });
        }
      }
    };
  }, [leadId]);

  async function saveImmediate(next: LeadProduct[]) {
    setItems(next);
    itemsRef.current = next;
    dirtyRef.current = false;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    try {
      await sendMessage({
        type: 'PRODUCTS_SET_FOR_LEAD',
        payload: { leadId, items: next }
      });
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao salvar produtos');
    }
  }

  function scheduleSave(next: LeadProduct[]) {
    setItems(next);
    itemsRef.current = next;
    dirtyRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      sendMessage({
        type: 'PRODUCTS_SET_FOR_LEAD',
        payload: { leadId, items: itemsRef.current }
      })
        .then(() => {
          dirtyRef.current = false;
        })
        .catch((err) => {
          onToast(err instanceof Error ? err.message : 'Erro ao salvar produtos');
        });
    }, 500);
  }

  function addProduct(p: Product) {
    const newItem: LeadProduct = {
      productId: p.id,
      name: p.name,
      quantity: 1,
      unitPrice: p.defaultPrice
    };
    void saveImmediate([...(items ?? []), newItem]);
    setPickerOpen(false);
  }

  function removeAt(index: number) {
    const next = (items ?? []).filter((_, i) => i !== index);
    void saveImmediate(next);
  }

  function updateAt(index: number, patch: Partial<LeadProduct>) {
    const next = (items ?? []).map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    scheduleSave(next);
  }

  if (!catalog || !items) {
    return (
      <div class="tribocrm-loading">
        <div class="tribocrm-spinner" />
      </div>
    );
  }

  const total = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  return (
    <div class="tribocrm-products">
      <button
        class="tribocrm-btn tribocrm-btn-ghost tribocrm-btn-full"
        onClick={() => setPickerOpen((v) => !v)}
        type="button"
      >
        <IconPlus size={14} /> Adicionar produto
      </button>

      {pickerOpen && (
        <div class="tribocrm-product-picker" role="listbox">
          {catalog.map((p) => (
            <button
              key={p.id}
              class="tribocrm-product-picker-item"
              onClick={() => addProduct(p)}
              type="button"
            >
              <span class="tribocrm-product-picker-name">{p.name}</span>
              <span class="tribocrm-product-picker-price">
                {formatCurrencyExact(p.defaultPrice)}
              </span>
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div class="tribocrm-products-empty">Nenhum produto adicionado.</div>
      ) : (
        <div class="tribocrm-product-list">
          {items.map((item, idx) => (
            <div class="tribocrm-product-item" key={`${item.productId}-${idx}`}>
              <div class="tribocrm-product-item-head">
                <span class="tribocrm-product-item-name">{item.name}</span>
                <button
                  class="tribocrm-product-remove"
                  onClick={() => removeAt(idx)}
                  title="Remover"
                  type="button"
                >
                  <IconX size={14} />
                </button>
              </div>
              <div class="tribocrm-product-item-fields">
                <div class="tribocrm-product-field">
                  <label class="tribocrm-product-field-label">Qtd</label>
                  <input
                    class="tribocrm-input tribocrm-product-input"
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onInput={(e) => {
                      const raw = Number((e.target as HTMLInputElement).value);
                      const v = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
                      updateAt(idx, { quantity: v });
                    }}
                  />
                </div>
                <div class="tribocrm-product-field">
                  <label class="tribocrm-product-field-label">Unit (R$)</label>
                  <input
                    class="tribocrm-input tribocrm-product-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onInput={(e) => {
                      const raw = Number((e.target as HTMLInputElement).value);
                      const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                      updateAt(idx, { unitPrice: v });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="tribocrm-product-total">
        <span class="tribocrm-product-total-label">Total</span>
        <span class="tribocrm-product-total-value">{formatCurrencyExact(total)}</span>
      </div>
    </div>
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
  lead,
  onClose,
  onToast
}: {
  lead: Lead;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sendMessage({ type: 'TEMPLATE_LIST' })
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'));
  }, []);

  function useTemplate(t: WhatsAppTemplate) {
    const texto = renderTemplate(t.body, lead);
    const ok = injectTextIntoChat(texto);
    onToast(ok ? 'Mensagem colada no chat' : 'Não foi possível colar no chat');
    if (ok) onClose();
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
        onClick={onClose}
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
