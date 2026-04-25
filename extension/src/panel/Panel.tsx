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
import type {
  Product,
  LeadProduct,
  LeadProductInput,
  LeadTask,
  LeadTaskType,
  LeadOutcome,
  LossReason
} from '@shared/types/extra';
import type { ComponentChildren } from 'preact';
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
  IconCalendar,
  IconClock,
  IconMoreVertical,
  IconTrash,
  IconEdit,
  IconChevronDown,
  IconCheckCircle,
  IconXCircle
} from './icons';
import {
  formatRelativeTime,
  formatCurrency,
  formatCurrencyExact,
  interactionTypeLabel,
  temperatureLabel,
  leadTaskTypeEmoji,
  formatTaskDueRelative,
  formatTaskDueAbsolute,
  formatDateShort,
  dateInputToLocalISO
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
      let lead = await sendMessage({
        type: 'LEAD_FIND_BY_PHONE',
        payload: { phone: effectiveContact.phone }
      });

      // Fallback: se backend/mock não achou pelo telefone, consulta o
      // mapa local de alt-phones. Se houver vínculo manual, busca o
      // lead por id. Entrada órfã (leadId cujo lead sumiu do backend)
      // cai transparentemente em lead-not-found — decisão consciente
      // pra não mascarar inconsistência.
      if (!lead) {
        const linkedId = await sendMessage({
          type: 'ALT_PHONE_FIND_LEAD_ID',
          payload: { phone: effectiveContact.phone }
        });
        if (linkedId) {
          lead = await sendMessage({
            type: 'LEAD_FIND_BY_ID',
            payload: { leadId: linkedId }
          });
        }
      }

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
              <LeadNotFoundView
                contact={state.contact}
                onCreated={reload}
                onLinked={reload}
                onToast={showToast}
              />
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
        O TriboCRM integra seu WhatsApp Web ao seu CRM, permitindo
        registrar leads e interações sem sair da plataforma.
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

type OutcomeModalKind = 'sell' | 'lose' | 'details' | null;

function LeadFoundView({ lead, interactions, onUpdate, onToast }: LeadFoundProps) {
  const [tab, setTab] = useState<Tab>('dados');
  const [outcome, setOutcome] = useState<LeadOutcome | null | undefined>(undefined);
  const [modal, setModal] = useState<OutcomeModalKind>(null);

  useEffect(() => {
    let cancelled = false;
    setOutcome(undefined);
    sendMessage({ type: 'LEAD_OUTCOME_GET', payload: { leadId: lead.id } })
      .then((result) => {
        if (!cancelled) setOutcome(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setOutcome(null);
        onToast(err instanceof Error ? err.message : 'Erro ao carregar outcome');
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  const outcomeLoaded = outcome !== undefined;
  const hasOutcome = outcome != null;

  async function handleOutcomeSaved(next: LeadOutcome, toastMsg: string) {
    setOutcome(next);
    setModal(null);
    onToast(toastMsg);
    // Re-fetch do lead pra pegar a stage atualizada (se o handler conseguiu).
    // Se falhou, lead volta igual — tudo bem, o outcome local manda.
    onUpdate();
  }

  return (
    <>
      <div
        class={`tribocrm-lead-mini ${
          outcomeLoaded ? 'tribocrm-lead-mini--with-outcome' : ''
        }`}
      >
        <div class="tribocrm-lead-mini-info">
          <h3 class="tribocrm-lead-name">{lead.name}</h3>
          {lead.company && <div class="tribocrm-lead-company">{lead.company}</div>}
        </div>
        <TemperatureBadge temperature={lead.temperature} />
      </div>

      {!outcomeLoaded ? (
        // Placeholder com altura reservada; o respiro de 14px vem do
        // padding-bottom do mini-header (classe --with-outcome ainda
        // não foi aplicada). Depois que carrega, o respiro passa a
        // vir do margin-bottom dos botões/badge.
        <div style={{ height: 38 }} />
      ) : hasOutcome ? (
        <OutcomeBadge outcome={outcome!} onDetails={() => setModal('details')} />
      ) : (
        <OutcomeButtons
          onSell={() => setModal('sell')}
          onLose={() => setModal('lose')}
        />
      )}

      <TabsBar active={tab} onChange={setTab} />

      {tab === 'dados' && (
        <DadosTab lead={lead} onUpdate={onUpdate} onToast={onToast} />
      )}
      {tab === 'notas' && <NotesTab leadId={lead.id} onToast={onToast} />}
      {tab === 'tarefas' && (
        <TasksTab leadId={lead.id} leadName={lead.name} onToast={onToast} />
      )}
      {tab === 'produtos' && <ProductsTab leadId={lead.id} onToast={onToast} />}
      {tab === 'historico' && <HistoricoTab interactions={interactions} />}

      {modal === 'sell' && (
        <SellModal
          lead={lead}
          onClose={() => setModal(null)}
          onSaved={(o) => handleOutcomeSaved(o, 'Venda registrada')}
        />
      )}
      {modal === 'lose' && (
        <LoseModal
          lead={lead}
          onClose={() => setModal(null)}
          onSaved={(o) => handleOutcomeSaved(o, 'Lead marcado como perdido')}
        />
      )}
      {modal === 'details' && outcome && (
        <OutcomeDetailsModal outcome={outcome} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ── Botões e badge de outcome ─────────────────────────────────

function OutcomeButtons({ onSell, onLose }: { onSell: () => void; onLose: () => void }) {
  return (
    <div class="tribocrm-outcome-buttons">
      <button type="button" class="tribocrm-btn-sell" onClick={onSell}>
        <IconCheckCircle size={14} /> Marcar venda
      </button>
      <button type="button" class="tribocrm-btn-lose" onClick={onLose}>
        <IconXCircle size={14} /> Marcar perda
      </button>
    </div>
  );
}

function OutcomeBadge({
  outcome,
  onDetails
}: {
  outcome: LeadOutcome;
  onDetails: () => void;
}) {
  const isWon = outcome.kind === 'won';
  const dateLabel = formatDateShort(outcome.closedAt);
  const wonExtra =
    isWon && outcome.amount != null && outcome.amount > 0
      ? ` · ${formatCurrency(outcome.amount)}`
      : '';
  const lostReason = outcome.reasonCustom?.trim() || outcome.reasonLabel || '';
  const lostExtra = !isWon && lostReason ? ` · ${lostReason}` : '';
  const label = isWon
    ? `Vendido em ${dateLabel}${wonExtra}`
    : `Perdido em ${dateLabel}${lostExtra}`;

  return (
    <div
      class={`tribocrm-outcome-badge ${
        isWon ? 'tribocrm-outcome-badge-won' : 'tribocrm-outcome-badge-lost'
      }`}
    >
      <span class="tribocrm-outcome-badge-icon">
        {isWon ? <IconCheckCircle size={16} /> : <IconXCircle size={16} />}
      </span>
      <span class="tribocrm-outcome-badge-text">{label}</span>
      <button type="button" class="tribocrm-outcome-details-btn" onClick={onDetails}>
        detalhes
      </button>
    </div>
  );
}

// ── Modal shell (ESC + backdrop click) ────────────────────────

function ModalShell({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="tribocrm-modal-backdrop" onClick={onClose} role="presentation">
      <div
        class="tribocrm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="tribocrm-modal-head">{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── Modal: Marcar venda ───────────────────────────────────────

function todayDateInputValue(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function SellModal({
  lead,
  onClose,
  onSaved
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (o: LeadOutcome) => void;
}) {
  const [amount, setAmount] = useState<string>('');
  const [closedAtDate, setClosedAtDate] = useState<string>(todayDateInputValue());
  const [leadProducts, setLeadProducts] = useState<LeadProduct[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendMessage({
      type: 'PRODUCTS_GET_FOR_LEAD',
      payload: { leadId: lead.id }
    })
      .then((list) => {
        if (cancelled) return;
        setLeadProducts(list);
        setSelected(new Set(list.map((_, i) => i))); // tudo marcado por default
      })
      .catch(() => {
        if (cancelled) return;
        setLeadProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0.01;
  const canSubmit = amountValid && !!closedAtDate && !saving && leadProducts !== null;

  function toggleProduct(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const subtotal = (leadProducts ?? []).reduce((acc, item, i) => {
    if (!selected.has(i)) return acc;
    return acc + item.quantity * item.unitPrice;
  }, 0);

  async function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const snapshot = (leadProducts ?? []).filter((_, i) => selected.has(i));
    const outcome: LeadOutcome = {
      leadId: lead.id,
      kind: 'won',
      amount: amountNum,
      products: snapshot,
      reasonId: null,
      reasonLabel: null,
      reasonCustom: null,
      closedAt: dateInputToLocalISO(closedAtDate),
      recordedAt: new Date().toISOString()
    };
    try {
      await sendMessage({
        type: 'LEAD_OUTCOME_SET',
        payload: { leadId: lead.id, pipelineId: lead.pipeline.id, outcome }
      });
      onSaved(outcome);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Erro ao salvar venda');
    }
  }

  return (
    <ModalShell title="Registrar venda" onClose={onClose}>
      <form class="tribocrm-modal-body" onSubmit={submit}>
        {error && <div class="tribocrm-modal-error">{error}</div>}

        <div class="tribocrm-field">
          <label class="tribocrm-field-label">Valor fechado (R$) *</label>
          <input
            class="tribocrm-input"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
            autofocus
            required
          />
        </div>

        <div class="tribocrm-field">
          <label class="tribocrm-field-label">Data de fechamento *</label>
          <input
            class="tribocrm-input"
            type="date"
            value={closedAtDate}
            onInput={(e) => setClosedAtDate((e.target as HTMLInputElement).value)}
            required
          />
        </div>

        {leadProducts === null ? null : leadProducts.length === 0 ? (
          <div class="tribocrm-modal-products-empty">
            Dica: cadastre produtos na aba Produtos para incluir aqui.
          </div>
        ) : (
          <div class="tribocrm-modal-products">
            <div class="tribocrm-modal-products-head">
              <span>Produtos</span>
              <span>Subtotal: {formatCurrencyExact(subtotal)}</span>
            </div>
            {leadProducts.map((item, idx) => (
              <label key={idx} class="tribocrm-modal-product-row">
                <input
                  type="checkbox"
                  checked={selected.has(idx)}
                  onChange={() => toggleProduct(idx)}
                />
                <span class="tribocrm-modal-product-row-name">
                  {item.product.name} · {item.quantity}×
                </span>
                <span class="tribocrm-modal-product-row-total">
                  {formatCurrencyExact(item.quantity * item.unitPrice)}
                </span>
              </label>
            ))}
          </div>
        )}
      </form>
      <div class="tribocrm-modal-foot">
        <button
          type="button"
          class="tribocrm-btn tribocrm-btn-ghost"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="tribocrm-btn-sell"
          onClick={submit}
          disabled={!canSubmit}
        >
          {saving ? 'Salvando...' : 'Confirmar venda'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal: Marcar perda ───────────────────────────────────────

function LoseModal({
  lead,
  onClose,
  onSaved
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (o: LeadOutcome) => void;
}) {
  const [reasons, setReasons] = useState<LossReason[] | null>(null);
  const [reasonId, setReasonId] = useState<string>('');
  const [reasonCustom, setReasonCustom] = useState<string>('');
  const [closedAtDate, setClosedAtDate] = useState<string>(todayDateInputValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendMessage({ type: 'LOSS_REASONS_LIST' })
      .then((list) => {
        if (!cancelled) setReasons(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setReasons([]);
        setError(err instanceof Error ? err.message : 'Erro ao carregar motivos');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isOther = reasonId === 'other';
  const customTrim = reasonCustom.trim();
  const canSubmit =
    !!reasonId &&
    !!closedAtDate &&
    !saving &&
    (!isOther || customTrim.length > 0);

  async function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit || !reasons) return;
    setSaving(true);
    setError(null);
    const reason = reasons.find((r) => r.id === reasonId) ?? null;
    const outcome: LeadOutcome = {
      leadId: lead.id,
      kind: 'lost',
      amount: null,
      products: [],
      reasonId,
      reasonLabel: reason?.label ?? null,
      reasonCustom: isOther ? customTrim : null,
      closedAt: dateInputToLocalISO(closedAtDate),
      recordedAt: new Date().toISOString()
    };
    try {
      await sendMessage({
        type: 'LEAD_OUTCOME_SET',
        payload: { leadId: lead.id, pipelineId: lead.pipeline.id, outcome }
      });
      onSaved(outcome);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Erro ao salvar perda');
    }
  }

  return (
    <ModalShell title="Registrar perda" onClose={onClose}>
      <form class="tribocrm-modal-body" onSubmit={submit}>
        {error && <div class="tribocrm-modal-error">{error}</div>}

        <div class="tribocrm-field">
          <label class="tribocrm-field-label">Motivo *</label>
          <select
            class="tribocrm-select"
            value={reasonId}
            onChange={(e) => setReasonId((e.target as HTMLSelectElement).value)}
            disabled={!reasons}
            required
            autofocus
          >
            <option value="">Selecione...</option>
            {(reasons ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {isOther && (
          <div class="tribocrm-field">
            <label class="tribocrm-field-label">Descreva *</label>
            <textarea
              class="tribocrm-textarea"
              value={reasonCustom}
              onInput={(e) =>
                setReasonCustom((e.target as HTMLTextAreaElement).value)
              }
              required
            />
          </div>
        )}

        <div class="tribocrm-field">
          <label class="tribocrm-field-label">Data *</label>
          <input
            class="tribocrm-input"
            type="date"
            value={closedAtDate}
            onInput={(e) => setClosedAtDate((e.target as HTMLInputElement).value)}
            required
          />
        </div>
      </form>
      <div class="tribocrm-modal-foot">
        <button
          type="button"
          class="tribocrm-btn tribocrm-btn-ghost"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="tribocrm-btn-lose"
          onClick={submit}
          disabled={!canSubmit}
        >
          {saving ? 'Salvando...' : 'Confirmar perda'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal: Detalhes do outcome ────────────────────────────────

function OutcomeDetailsModal({
  outcome,
  onClose
}: {
  outcome: LeadOutcome;
  onClose: () => void;
}) {
  const isWon = outcome.kind === 'won';
  const title = isWon ? 'Detalhes da venda' : 'Detalhes da perda';
  const productsTotal = outcome.products.reduce(
    (acc, p) => acc + p.quantity * p.unitPrice,
    0
  );

  return (
    <ModalShell title={title} onClose={onClose}>
      <div class="tribocrm-modal-body">
        <div class="tribocrm-modal-details-row">
          <span class="tribocrm-modal-details-row-label">Status</span>
          <span class="tribocrm-modal-details-row-value">
            {isWon ? 'Vendido' : 'Perdido'}
          </span>
        </div>
        <div class="tribocrm-modal-details-row">
          <span class="tribocrm-modal-details-row-label">
            {isWon ? 'Fechado em' : 'Registrado em'}
          </span>
          <span class="tribocrm-modal-details-row-value">
            {formatDateShort(outcome.closedAt)}
          </span>
        </div>

        {isWon && (
          <>
            <div class="tribocrm-modal-details-row">
              <span class="tribocrm-modal-details-row-label">Valor</span>
              <span class="tribocrm-modal-details-row-value">
                {outcome.amount != null
                  ? formatCurrencyExact(outcome.amount)
                  : '—'}
              </span>
            </div>
            {outcome.products.length > 0 && (
              <>
                <div class="tribocrm-modal-details-divider" />
                <div class="tribocrm-modal-products">
                  <div class="tribocrm-modal-products-head">
                    <span>Produtos (snapshot)</span>
                    <span>Subtotal: {formatCurrencyExact(productsTotal)}</span>
                  </div>
                  {outcome.products.map((p, i) => (
                    <div key={i} class="tribocrm-modal-product-row">
                      <span class="tribocrm-modal-product-row-name">
                        {p.product.name} · {p.quantity}× {formatCurrencyExact(p.unitPrice)}
                      </span>
                      <span class="tribocrm-modal-product-row-total">
                        {formatCurrencyExact(p.quantity * p.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {!isWon && (
          <>
            <div class="tribocrm-modal-details-row">
              <span class="tribocrm-modal-details-row-label">Motivo</span>
              <span class="tribocrm-modal-details-row-value">
                {outcome.reasonLabel ?? '—'}
              </span>
            </div>
            {outcome.reasonCustom && (
              <div class="tribocrm-modal-details-row">
                <span class="tribocrm-modal-details-row-label">Descrição</span>
                <span class="tribocrm-modal-details-row-value">
                  {outcome.reasonCustom}
                </span>
              </div>
            )}
          </>
        )}
      </div>
      <div class="tribocrm-modal-foot" style={{ gridTemplateColumns: '1fr' }}>
        <button
          type="button"
          class="tribocrm-btn tribocrm-btn-ghost"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </ModalShell>
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

// ── Aba Tarefas ───────────────────────────────────────────────

type TaskFormMode =
  | { kind: 'hidden' }
  | { kind: 'create' }
  | { kind: 'edit'; task: LeadTask };

function TasksTab({
  leadId,
  leadName,
  onToast
}: {
  leadId: string;
  leadName: string;
  onToast: (m: string) => void;
}) {
  const [tasks, setTasks] = useState<LeadTask[] | null>(null);
  const [formMode, setFormMode] = useState<TaskFormMode>({ kind: 'hidden' });
  const [doneOpen, setDoneOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    sendMessage({ type: 'LEAD_TASK_LIST', payload: { leadId } })
      .then((list) => {
        if (cancelled) return;
        setTasks(list);
      })
      .catch((err) => {
        if (cancelled) return;
        onToast(err instanceof Error ? err.message : 'Erro ao carregar tarefas');
        setTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!menuOpenId) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.tribocrm-task-menu-wrap')) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [menuOpenId]);

  // Re-render a cada 60s pra atualizar "em 2h" / "há 3h"
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  async function handleCreate(input: {
    title: string;
    description: string;
    type: LeadTaskType;
    dueAt: string;
  }) {
    try {
      const created = await sendMessage({
        type: 'LEAD_TASK_CREATE',
        payload: { leadId, leadName, ...input }
      });
      setTasks((prev) => [...(prev ?? []), created]);
      setFormMode({ kind: 'hidden' });
      onToast('Tarefa criada');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar tarefa');
    }
  }

  async function handleUpdate(
    taskId: string,
    patch: Partial<Pick<LeadTask, 'title' | 'description' | 'type' | 'dueAt'>>
  ) {
    try {
      const updated = await sendMessage({
        type: 'LEAD_TASK_UPDATE',
        payload: { leadId, taskId, patch }
      });
      setTasks((prev) =>
        (prev ?? []).map((t) => (t.id === taskId ? updated : t))
      );
      setFormMode({ kind: 'hidden' });
      onToast('Tarefa atualizada');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  }

  async function handleDelete(taskId: string) {
    const prev = tasks ?? [];
    setTasks(prev.filter((t) => t.id !== taskId));
    setMenuOpenId(null);
    try {
      await sendMessage({
        type: 'LEAD_TASK_DELETE',
        payload: { leadId, taskId }
      });
      onToast('Tarefa excluída');
    } catch (err) {
      setTasks(prev);
      onToast(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  async function handleToggleDone(task: LeadTask) {
    const nextStatus = task.status === 'pending' ? 'done' : 'pending';
    const prev = tasks ?? [];
    setTasks(
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === 'done' ? new Date().toISOString() : null
            }
          : t
      )
    );
    try {
      const updated = await sendMessage({
        type: 'LEAD_TASK_MARK',
        payload: { leadId, taskId: task.id, status: nextStatus }
      });
      setTasks((curr) =>
        (curr ?? []).map((t) => (t.id === task.id ? updated : t))
      );
    } catch (err) {
      setTasks(prev);
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar tarefa');
    }
  }

  if (tasks === null) {
    return (
      <div class="tribocrm-loading">
        <div class="tribocrm-spinner" />
      </div>
    );
  }

  const pending = [...tasks.filter((t) => t.status === 'pending')].sort((a, b) => {
    const now = Date.now();
    const aOverdue = Date.parse(a.dueAt) < now;
    const bOverdue = Date.parse(b.dueAt) < now;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  });
  const done = [...tasks.filter((t) => t.status === 'done')].sort((a, b) => {
    const ta = a.completedAt ? Date.parse(a.completedAt) : 0;
    const tb = b.completedAt ? Date.parse(b.completedAt) : 0;
    return tb - ta;
  });

  const isEmpty = tasks.length === 0 && formMode.kind === 'hidden';

  return (
    <div class="tribocrm-tasks">
      {formMode.kind === 'hidden' && !isEmpty && (
        <button
          class="tribocrm-btn tribocrm-btn-primary tribocrm-btn-full"
          onClick={() => setFormMode({ kind: 'create' })}
          type="button"
        >
          <IconPlus size={14} /> Nova tarefa
        </button>
      )}

      {formMode.kind !== 'hidden' && (
        <TaskForm
          initial={formMode.kind === 'edit' ? formMode.task : null}
          onCancel={() => setFormMode({ kind: 'hidden' })}
          onSubmit={(input) => {
            if (formMode.kind === 'edit') {
              return handleUpdate(formMode.task.id, input);
            }
            return handleCreate(input);
          }}
        />
      )}

      {isEmpty && (
        <div class="tribocrm-empty">
          <div class="tribocrm-empty-icon">
            <IconCalendar size={24} />
          </div>
          <div>Nenhuma tarefa ainda.</div>
          <button
            class="tribocrm-btn tribocrm-btn-primary"
            onClick={() => setFormMode({ kind: 'create' })}
            type="button"
            style={{ marginTop: 12 }}
          >
            <IconPlus size={14} /> Nova tarefa
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <div class="tribocrm-task-section-title">Pendentes ({pending.length})</div>
          <div class="tribocrm-task-list">
            {pending.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                menuOpen={menuOpenId === t.id}
                onToggleMenu={() =>
                  setMenuOpenId((curr) => (curr === t.id ? null : t.id))
                }
                onToggleDone={() => handleToggleDone(t)}
                onEdit={() => {
                  setMenuOpenId(null);
                  setFormMode({ kind: 'edit', task: t });
                }}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <button
            class="tribocrm-task-done-toggle"
            onClick={() => setDoneOpen((v) => !v)}
            type="button"
            aria-expanded={doneOpen}
          >
            <IconChevronDown
              size={14}
              class={doneOpen ? 'tribocrm-task-chev-open' : ''}
            />
            <span>Concluídas ({done.length})</span>
          </button>
          {doneOpen && (
            <div class="tribocrm-task-list">
              {done.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  menuOpen={menuOpenId === t.id}
                  onToggleMenu={() =>
                    setMenuOpenId((curr) => (curr === t.id ? null : t.id))
                  }
                  onToggleDone={() => handleToggleDone(t)}
                  onEdit={() => {
                    setMenuOpenId(null);
                    setFormMode({ kind: 'edit', task: t });
                  }}
                  onDelete={() => handleDelete(t.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskItem({
  task,
  menuOpen,
  onToggleMenu,
  onToggleDone,
  onEdit,
  onDelete
}: {
  task: LeadTask;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDone = task.status === 'done';
  const overdue = !isDone && Date.parse(task.dueAt) < Date.now();

  const subLabel = isDone
    ? task.completedAt
      ? `Concluída ${formatRelativeTime(task.completedAt)}`
      : 'Concluída'
    : formatTaskDueRelative(task.dueAt);

  return (
    <div
      class={`tribocrm-task-item ${isDone ? 'tribocrm-task-item-done' : ''} ${
        overdue ? 'tribocrm-task-item-overdue' : ''
      }`}
    >
      <label class="tribocrm-task-check">
        <input
          type="checkbox"
          checked={isDone}
          onChange={onToggleDone}
          aria-label={isDone ? 'Desmarcar como concluída' : 'Marcar como concluída'}
        />
      </label>

      <div class="tribocrm-task-body">
        <div class="tribocrm-task-head">
          <span class="tribocrm-task-type-emoji" aria-hidden="true">
            {leadTaskTypeEmoji(task.type)}
          </span>
          <span class="tribocrm-task-title">{task.title}</span>
        </div>
        <div class="tribocrm-task-sub">
          {overdue && (
            <span class="tribocrm-task-overdue-badge">
              <IconClock size={10} /> Vencida
            </span>
          )}
          <span class="tribocrm-task-due">{subLabel}</span>
        </div>
        {task.description && (
          <div class="tribocrm-task-desc">{task.description}</div>
        )}
      </div>

      <div class="tribocrm-task-menu-wrap">
        <button
          type="button"
          class="tribocrm-task-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          aria-label="Opções da tarefa"
          aria-expanded={menuOpen}
        >
          <IconMoreVertical size={14} />
        </button>
        {menuOpen && (
          <div class="tribocrm-task-menu" role="menu">
            <button
              type="button"
              class="tribocrm-task-menu-item"
              onClick={onEdit}
              role="menuitem"
            >
              <IconEdit size={12} /> Editar
            </button>
            <button
              type="button"
              class="tribocrm-task-menu-item tribocrm-task-menu-item-danger"
              onClick={onDelete}
              role="menuitem"
            >
              <IconTrash size={12} /> Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskForm({
  initial,
  onCancel,
  onSubmit
}: {
  initial: LeadTask | null;
  onCancel: () => void;
  onSubmit: (input: {
    title: string;
    description: string;
    type: LeadTaskType;
    dueAt: string;
  }) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<LeadTaskType>(initial?.type ?? 'call');
  const [dueAt, setDueAt] = useState<string>(initial?.dueAt ?? '');
  const [customOpen, setCustomOpen] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Título obrigatório');
      return;
    }
    if (!dueAt) {
      setError('Escolha data e hora');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: trimmed,
        description: description.trim(),
        type,
        dueAt
      });
    } catch {
      setSaving(false);
    }
  }

  return (
    <form class="tribocrm-task-form" onSubmit={submit}>
      <div class="tribocrm-section-title">
        {initial ? 'Editar tarefa' : 'Nova tarefa'}
      </div>
      {error && <div class="tribocrm-error-banner">{error}</div>}

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Título *</label>
        <input
          class="tribocrm-input"
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          autofocus
          required
        />
      </div>

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Tipo</label>
        <select
          class="tribocrm-select"
          value={type}
          onChange={(e) =>
            setType((e.target as HTMLSelectElement).value as LeadTaskType)
          }
        >
          <option value="call">Ligação</option>
          <option value="visit">Visita</option>
          <option value="meeting">Reunião</option>
          <option value="email">E-mail</option>
          <option value="other">Outro</option>
        </select>
      </div>

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Quando</label>
        <DateShortcuts
          value={dueAt}
          onChange={setDueAt}
          customOpen={customOpen}
          onOpenCustom={() => setCustomOpen(true)}
        />
        {dueAt && (
          <div class="tribocrm-task-due-preview">
            {formatTaskDueAbsolute(dueAt)}
          </div>
        )}
      </div>

      <div class="tribocrm-field">
        <label class="tribocrm-field-label">Descrição</label>
        <textarea
          class="tribocrm-textarea"
          value={description}
          onInput={(e) =>
            setDescription((e.target as HTMLTextAreaElement).value)
          }
          placeholder="Opcional"
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
          disabled={saving || !title.trim() || !dueAt}
        >
          {saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}

// ── Presets de data/hora ───────────────────────────────────────

function toLocalInputValue(date: Date): string {
  // formato esperado por <input type="datetime-local"> no fuso local
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  // value vem como "YYYY-MM-DDTHH:mm" no fuso local → converte pra ISO UTC
  const d = new Date(value);
  return d.toISOString();
}

function makeIn1Hour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

/** Hoje às 18h; se já passou, amanhã às 18h. Label muda conforme. */
function makeToday18h(): { date: Date; label: string } {
  const now = new Date();
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
    return { date: d, label: 'Amanhã 18h' };
  }
  return { date: d, label: 'Hoje 18h' };
}

function makeTomorrow9h(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Próxima segunda-feira às 9h. Se hoje for segunda, vai pra próxima semana. */
function makeNextMonday9h(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Dom 1=Seg ... 6=Sáb
  let delta = (1 - day + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  d.setHours(9, 0, 0, 0);
  return d;
}

function DateShortcuts({
  value,
  onChange,
  customOpen,
  onOpenCustom
}: {
  value: string;
  onChange: (iso: string) => void;
  customOpen: boolean;
  onOpenCustom: () => void;
}) {
  const today18h = makeToday18h();

  const presets = [
    { label: 'Daqui 1h', make: () => makeIn1Hour() },
    { label: today18h.label, make: () => today18h.date },
    { label: 'Amanhã 9h', make: () => makeTomorrow9h() },
    { label: 'Próx. seg', make: () => makeNextMonday9h() }
  ];

  function apply(date: Date) {
    onChange(date.toISOString());
  }

  return (
    <div class="tribocrm-date-shortcuts-wrap">
      <div class="tribocrm-date-shortcuts">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            class="tribocrm-date-chip"
            onClick={() => apply(p.make())}
          >
            {p.label}
          </button>
        ))}
        {!customOpen && (
          <button
            type="button"
            class="tribocrm-date-chip tribocrm-date-chip-ghost"
            onClick={onOpenCustom}
          >
            + outro horário
          </button>
        )}
      </div>

      {customOpen && (
        <input
          type="datetime-local"
          class="tribocrm-input tribocrm-date-custom"
          value={value ? toLocalInputValue(new Date(value)) : ''}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            onChange(v ? fromLocalInputValue(v) : '');
          }}
        />
      )}
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
            payload: { leadId, items: itemsRef.current.map(toInput) }
          });
        }
      }
    };
  }, [leadId]);

  // Backend espera LeadProductInput[]; o state local é LeadProduct[] (com
  // id/finalPrice canônicos). Converte na borda da request.
  function toInput(lp: LeadProduct): LeadProductInput {
    return {
      productId: lp.productId,
      quantity: lp.quantity,
      discountPercent: lp.discountPercent,
    };
  }

  async function saveImmediate(nextItems: LeadProduct[]) {
    setItems(nextItems);
    itemsRef.current = nextItems;
    dirtyRef.current = false;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    try {
      const result = await sendMessage({
        type: 'PRODUCTS_SET_FOR_LEAD',
        payload: { leadId, items: nextItems.map(toInput) }
      });
      setItems(result);
      itemsRef.current = result;
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao salvar produtos');
    }
  }

  function scheduleSave(nextItems: LeadProduct[]) {
    setItems(nextItems);
    itemsRef.current = nextItems;
    dirtyRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      sendMessage({
        type: 'PRODUCTS_SET_FOR_LEAD',
        payload: { leadId, items: itemsRef.current.map(toInput) }
      })
        .then((result) => {
          dirtyRef.current = false;
          setItems(result);
          itemsRef.current = result;
        })
        .catch((err) => {
          onToast(err instanceof Error ? err.message : 'Erro ao salvar produtos');
        });
    }, 500);
  }

  function addProduct(p: Product) {
    // Otimismo visual: mostra placeholder até backend devolver o canônico
    const placeholder: LeadProduct = {
      id: `temp-${Date.now()}`,
      productId: p.id,
      quantity: 1,
      unitPrice: p.price,
      discountPercent: null,
      finalPrice: p.price,
      createdAt: new Date().toISOString(),
      product: { id: p.id, name: p.name, category: p.category },
    };
    void saveImmediate([...(items ?? []), placeholder]);
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
                {formatCurrencyExact(p.price)}
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
                <span class="tribocrm-product-item-name">{item.product.name}</span>
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
  onLinked,
  onToast
}: {
  contact: WhatsAppContactInfo;
  onCreated: () => void;
  onLinked: () => void;
  onToast: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'linking'>('view');
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

  if (mode === 'linking') {
    return (
      <LinkExistingLeadView
        contact={contact}
        onLinked={onLinked}
        onCancel={() => setMode('view')}
        onToast={onToast}
      />
    );
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
        <button
          type="button"
          class="tribocrm-link-trigger"
          onClick={() => setMode('linking')}
        >
          ou vincular a lead existente
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

// ── Visão: vincular telefone detectado a lead existente ───────
//
// Sub-estado do 'lead-not-found' — NÃO é um modal, é uma
// transição in-place. Busca leads por nome/empresa via LEAD_SEARCH
// (debounce 300ms, >=2 chars), ao escolher um resultado pede
// confirmação inline antes de gravar o mapeamento em
// lead-alt-phones:{userId}. onLinked() dispara reload() do pai,
// que re-resolve o contato e cai em 'lead-found'.
function LinkExistingLeadView({
  contact,
  onLinked,
  onCancel,
  onToast
}: {
  contact: WhatsAppContactInfo;
  onLinked: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  // Evita race: uma resposta antiga sobrescrevendo uma nova.
  const reqIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const myReqId = ++reqIdRef.current;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      sendMessage({ type: 'LEAD_SEARCH', payload: { query: trimmed } })
        .then((list) => {
          if (myReqId !== reqIdRef.current) return;
          setResults(list);
          setSearched(true);
          setLoading(false);
        })
        .catch((err) => {
          if (myReqId !== reqIdRef.current) return;
          setError(err instanceof Error ? err.message : 'Erro ao buscar');
          setLoading(false);
        });
    }, 300);
  }

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await sendMessage({
        type: 'ALT_PHONE_LINK',
        payload: { phone: contact.phone, leadId: selected.id }
      });
      onToast(`Telefone vinculado a ${selected.name}`);
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao vincular');
      setSaving(false);
    }
  }

  const trimmed = query.trim();
  const showHintMin = !selected && trimmed.length < 2;
  const showHintLoading = !selected && trimmed.length >= 2 && loading;
  const showHintEmpty =
    !selected && trimmed.length >= 2 && !loading && searched && results.length === 0;
  const showResults = !selected && !loading && results.length > 0;

  return (
    <div class="tribocrm-link-existing">
      <button type="button" class="tribocrm-link-back" onClick={onCancel}>
        ← voltar
      </button>

      <div class="tribocrm-link-header">
        <strong>{contact.displayName}</strong>
        <span class="tribocrm-link-header-phone">+{contact.phone}</span>
      </div>

      {error && <div class="tribocrm-error-banner">{error}</div>}

      {!selected && (
        <>
          <input
            class="tribocrm-input tribocrm-link-search"
            placeholder="Buscar lead por nome ou empresa..."
            value={query}
            onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
            autofocus
          />

          <div class="tribocrm-link-results">
            {showHintMin && (
              <div class="tribocrm-link-hint">Digite ao menos 2 caracteres…</div>
            )}
            {showHintLoading && (
              <div class="tribocrm-link-hint">Buscando…</div>
            )}
            {showHintEmpty && (
              <div class="tribocrm-link-hint">Nenhum lead encontrado</div>
            )}
            {showResults &&
              results.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  class="tribocrm-link-result-item"
                  onClick={() => setSelected(lead)}
                >
                  <div class="tribocrm-link-result-name">{lead.name}</div>
                  <div class="tribocrm-link-result-meta">
                    {lead.company && <span>{lead.company}</span>}
                    <span
                      class="tribocrm-link-result-stage"
                      style={{
                        background: `${lead.stage.color}22`,
                        color: lead.stage.color
                      }}
                    >
                      {lead.stage.name}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}

      {selected && (
        <div class="tribocrm-link-confirm">
          <div class="tribocrm-link-confirm-text">
            Vincular <strong>+{contact.phone}</strong> ao lead{' '}
            <strong>{selected.name}</strong>?
          </div>
          <div class="tribocrm-btn-group">
            <button
              type="button"
              class="tribocrm-btn tribocrm-btn-ghost"
              onClick={() => setSelected(null)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              class="tribocrm-btn tribocrm-btn-primary"
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? 'Vinculando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
