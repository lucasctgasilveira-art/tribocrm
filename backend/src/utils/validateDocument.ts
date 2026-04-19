// Shared CPF/CNPJ validation util. Keep this file byte-identical
// between backend and frontend — changing one side without the other
// creates a trust gap (a digit accepted client-side that the server
// rejects, or vice-versa). Pure TS, zero deps.

export function stripDocument(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function formatCPF(value: string): string {
  const d = stripDocument(value).slice(0, 11)
  const a = d.slice(0, 3)
  const b = d.slice(3, 6)
  const c = d.slice(6, 9)
  const e = d.slice(9, 11)
  let out = a
  if (b) out += '.' + b
  if (c) out += '.' + c
  if (e) out += '-' + e
  return out
}

export function formatCNPJ(value: string): string {
  const d = stripDocument(value).slice(0, 14)
  const a = d.slice(0, 2)
  const b = d.slice(2, 5)
  const c = d.slice(5, 8)
  const f = d.slice(8, 12)
  const e = d.slice(12, 14)
  let out = a
  if (b) out += '.' + b
  if (c) out += '.' + c
  if (f) out += '/' + f
  if (e) out += '-' + e
  return out
}

export type DocumentType = 'CPF' | 'CNPJ'

export function detectDocumentType(value: string | null | undefined): DocumentType | null {
  const d = stripDocument(value)
  if (d.length === 11) return 'CPF'
  if (d.length === 14) return 'CNPJ'
  return null
}

// Live-mask: CPF shape while <=11 digits, CNPJ shape at 12-14.
// Matches the existing `maskDocumentBR` in CheckoutPage so the
// Boleto pre-fill and the /signup input render identically.
export function formatDocument(value: string | null | undefined): string {
  const d = stripDocument(value)
  if (d.length <= 11) return formatCPF(d)
  return formatCNPJ(d)
}

function allSameDigit(s: string): boolean {
  return s.length > 0 && /^(\d)\1+$/.test(s)
}

export function isValidCPF(value: string | null | undefined): boolean {
  const cpf = stripDocument(value)
  if (cpf.length !== 11) return false
  if (allSameDigit(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i), 10) * (10 - i)
  let rev = (sum * 10) % 11
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(9), 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i), 10) * (11 - i)
  rev = (sum * 10) % 11
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(10), 10)) return false

  return true
}

export function isValidCNPJ(value: string | null | undefined): boolean {
  const cnpj = stripDocument(value)
  if (cnpj.length !== 14) return false
  if (allSameDigit(cnpj)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj.charAt(i), 10) * (weights1[i] as number)
  let rem = sum % 11
  const digit1 = rem < 2 ? 0 : 11 - rem
  if (digit1 !== parseInt(cnpj.charAt(12), 10)) return false

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj.charAt(i), 10) * (weights2[i] as number)
  rem = sum % 11
  const digit2 = rem < 2 ? 0 : 11 - rem
  if (digit2 !== parseInt(cnpj.charAt(13), 10)) return false

  return true
}

export interface ValidateResult {
  valid: boolean
  type?: DocumentType
  formatted?: string
  error?: string
}

export function validateDocument(value: string | null | undefined): ValidateResult {
  const d = stripDocument(value)
  if (d.length === 0) {
    return { valid: false, error: 'CPF/CNPJ é obrigatório.' }
  }
  if (d.length !== 11 && d.length !== 14) {
    return { valid: false, error: 'Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).' }
  }
  if (d.length === 11) {
    if (!isValidCPF(d)) return { valid: false, type: 'CPF', error: 'CPF inválido.' }
    return { valid: true, type: 'CPF', formatted: formatCPF(d) }
  }
  if (!isValidCNPJ(d)) return { valid: false, type: 'CNPJ', error: 'CNPJ inválido.' }
  return { valid: true, type: 'CNPJ', formatted: formatCNPJ(d) }
}
