/**
 * Normaliza números de telefone brasileiros para o formato E.164 sem o '+'.
 *
 * Entrada: qualquer formato de telefone (com ou sem código de país, máscara, espaços)
 * Saída: apenas dígitos, com DDI 55 quando for número brasileiro
 *
 * Exemplos:
 *   "+55 (21) 91234-5678"  →  "5521912345678"
 *   "21 91234-5678"         →  "5521912345678"
 *   "+1 415-555-0100"       →  "14155550100"
 *   "912345678"             →  null  (DDD ausente — inválido)
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;

  // Remove tudo que não é dígito
  const digits = input.replace(/\D/g, '');

  // Já tem código de país (começa com 55 + DDD válido + 10-11 dígitos)
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  // Número brasileiro sem DDI: DDD (2) + celular (9) = 11 dígitos, ou fixo = 10
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Número internacional com outro DDI — retorna como está se tiver tamanho plausível
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Formata um telefone normalizado em exibição amigável: +55 (21) 91234-5678
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164) return '';

  if (e164.startsWith('55') && (e164.length === 12 || e164.length === 13)) {
    const ddd = e164.slice(2, 4);
    const rest = e164.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return `+${e164}`;
}
