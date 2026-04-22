/**
 * Helpers de formatação usados na UI do painel.
 */

import type { LeadTaskType } from '@shared/types/extra';

/**
 * Formata uma data ISO em "há X tempo" em português.
 * Exemplos: "agora", "há 3 min", "há 2h", "ontem", "há 3 dias", "15/04".
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD === 1) return 'ontem';
  if (diffD < 7) return `há ${diffD} dias`;

  // Mais antigo: dd/MM
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/**
 * Formata um valor monetário em BRL.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Formata BRL com 2 casas decimais sempre — uso em produtos
 * (preços unitários e totais com centavos).
 */
export function formatCurrencyExact(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Traduz o tipo de interação para exibição.
 */
export function interactionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CALL: 'Ligação',
    WHATSAPP: 'WhatsApp',
    EMAIL: 'E-mail',
    MEETING: 'Reunião',
    NOTE: 'Anotação',
    VISIT: 'Visita'
  };
  return map[type] ?? type;
}

/**
 * Traduz temperatura.
 */
export function temperatureLabel(t: string): string {
  const map: Record<string, string> = {
    HOT: 'Quente',
    WARM: 'Morno',
    COLD: 'Frio'
  };
  return map[t] ?? t;
}

// ── Tarefas ────────────────────────────────────────────────────

export function leadTaskTypeLabel(type: LeadTaskType): string {
  const map: Record<LeadTaskType, string> = {
    call: 'Ligação',
    visit: 'Visita',
    meeting: 'Reunião',
    email: 'E-mail',
    other: 'Outro'
  };
  return map[type];
}

export function leadTaskTypeEmoji(type: LeadTaskType): string {
  const map: Record<LeadTaskType, string> = {
    call: '📞',
    visit: '🏢',
    meeting: '📅',
    email: '✉️',
    other: '📌'
  };
  return map[type];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHourShort(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  if (m === 0) return `${h}h`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const WEEKDAY_SHORT_PT = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado'
];

/**
 * Formata dueAt em pt-BR, curto, orientado ao futuro.
 *   "em 3 min", "em 2h", "hoje 18h", "amanhã 09h", "quinta 15h", "03/05 14h".
 * Para tarefas no passado (vencidas): "há 2h", "há 3 dias".
 */
export function formatTaskDueRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const past = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const absMin = Math.floor(absMs / 60_000);
  const absH = Math.floor(absMs / 3_600_000);

  if (past) {
    if (absMin < 1) return 'agora';
    if (absMin < 60) return `há ${absMin} min`;
    if (absH < 24) return `há ${absH}h`;
    const absD = Math.floor(absMs / 86_400_000);
    if (absD === 1) return 'ontem';
    if (absD < 7) return `há ${absD} dias`;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  if (absMin < 1) return 'agora';
  if (absMin < 60) return `em ${absMin} min`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (isSameDay(date, now)) {
    if (absH < 3) return `em ${absH}h`;
    return `hoje ${formatHourShort(date)}`;
  }
  if (isSameDay(date, tomorrow)) {
    return `amanhã ${formatHourShort(date)}`;
  }

  const dateDay = new Date(date);
  dateDay.setHours(0, 0, 0, 0);
  const nowDay = new Date(now);
  nowDay.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (dateDay.getTime() - nowDay.getTime()) / 86_400_000
  );

  if (diffDays < 7) {
    return `${WEEKDAY_SHORT_PT[date.getDay()]} ${formatHourShort(date)}`;
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm} ${formatHourShort(date)}`;
}

/**
 * Formato longo em pt-BR pro preview do form:
 *   "Quinta-feira, 24 de abril às 09:00"
 */
export function formatTaskDueAbsolute(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const dayMonth = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long'
  }).format(date);
  const hour = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
  // Capitaliza primeira letra do dia da semana
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${weekdayCap}, ${dayMonth} às ${hour}`;
}
