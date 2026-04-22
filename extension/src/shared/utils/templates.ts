/**
 * Renderização de templates de mensagem com variáveis dinâmicas.
 *
 * Sintaxe: {{variavel}}
 *
 * Variáveis suportadas:
 *   - {{nome}}           → lead.name (nome completo)
 *   - {{primeiro_nome}}  → primeira palavra de lead.name
 *   - {{empresa}}        → lead.company
 *   - {{valor}}          → lead.expectedValue formatado em BRL
 *   - {{produto}}        → "(produto)" literal (placeholder — ver TODO)
 *
 * Regras:
 *   - Variável não reconhecida: mantém o literal no texto (não substitui).
 *   - Variável reconhecida com valor null/undefined: substitui por ''.
 */

import type { Lead } from '@shared/types/domain';
import { formatCurrency } from '@panel/format';

type Resolver = (lead: Lead) => string;

const RESOLVERS: Record<string, Resolver> = {
  nome: (lead) => lead.name ?? '',
  primeiro_nome: (lead) => (lead.name ?? '').trim().split(/\s+/)[0] ?? '',
  empresa: (lead) => lead.company ?? '',
  valor: (lead) =>
    lead.expectedValue != null ? formatCurrency(lead.expectedValue) : '',
  // TODO: Lead ainda não tem campo products[]. Quando o modelo ganhar
  // esse campo, trocar o literal por lead.products[0]?.name (ou similar)
  // para que a substituição passe a funcionar de verdade.
  produto: () => '(produto)'
};

/**
 * Renderiza um template substituindo variáveis {{xxx}} pelos dados do lead.
 *
 * @example
 *   renderTemplate('Oi {{primeiro_nome}}!', lead) // → 'Oi Rafael!'
 */
export function renderTemplate(template: string, lead: Lead): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const resolver = RESOLVERS[name];
    if (!resolver) return match;
    return resolver(lead);
  });
}
