/**
 * Helpers de formatação usados na UI do painel.
 */

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
