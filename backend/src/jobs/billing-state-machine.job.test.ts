/// <reference types="vitest/globals" />
// Unit tests dos helpers puros do billing-state-machine (sub-etapa 6K.2).
// Zero I/O, zero mock — apenas entrada/saída dos 6 formatters exportados.

import {
  daysUntil,
  formatValor,
  formatDataBR,
  formatMetodo,
  getFirstName,
  buildParamsForState,
} from './billing-state-machine.job'

describe('daysUntil', () => {
  it('retorna 0 quando target e now caem no mesmo dia UTC', () => {
    const now = new Date('2026-04-20T12:00:00Z')
    const target = new Date('2026-04-20T23:59:59Z')
    expect(daysUntil(target, now)).toBe(0)
  })

  it('retorna 7 quando target é 7 dias à frente', () => {
    const now = new Date('2026-04-20T12:00:00Z')
    const target = new Date('2026-04-27T12:00:00Z')
    expect(daysUntil(target, now)).toBe(7)
  })

  it('retorna 1 quando target é amanhã', () => {
    const now = new Date('2026-04-20T12:00:00Z')
    const target = new Date('2026-04-21T12:00:00Z')
    expect(daysUntil(target, now)).toBe(1)
  })

  it('retorna -1 quando target era ontem', () => {
    const now = new Date('2026-04-20T12:00:00Z')
    const target = new Date('2026-04-19T12:00:00Z')
    expect(daysUntil(target, now)).toBe(-1)
  })

  it('retorna -10 quando target era 10 dias atrás', () => {
    const now = new Date('2026-04-20T12:00:00Z')
    const target = new Date('2026-04-10T12:00:00Z')
    expect(daysUntil(target, now)).toBe(-10)
  })

  it('lida com cruzamento de mês', () => {
    const now = new Date('2026-04-28T12:00:00Z')
    const target = new Date('2026-05-05T12:00:00Z')
    expect(daysUntil(target, now)).toBe(7)
  })

  it('lida com fevereiro de ano bissexto', () => {
    const now = new Date('2024-02-25T12:00:00Z')
    const target = new Date('2024-03-03T12:00:00Z')
    expect(daysUntil(target, now)).toBe(7)
  })
})

describe('formatValor', () => {
  it('MONTHLY: retorna "R$ X,XX/mês" independente do método', () => {
    expect(formatValor(197, 1970, 'MONTHLY', 'PIX')).toBe('R$ 197,00/mês')
    expect(formatValor(197, 1970, 'MONTHLY', 'CREDIT_CARD')).toBe('R$ 197,00/mês')
  })

  it('YEARLY + CREDIT_CARD: parcela 12x calculada da anual', () => {
    // 1970/12 = 164.166... → toFixed(2) = "164.17"
    expect(formatValor(197, 1970, 'YEARLY', 'CREDIT_CARD')).toBe(
      '12× de R$ 164,17 no cartão',
    )
  })

  it('YEARLY + PIX: retorna "R$ X,XX à vista"', () => {
    expect(formatValor(197, 1970, 'YEARLY', 'PIX')).toBe('R$ 1970,00 à vista')
  })

  it('YEARLY + BOLETO: também cai em "à vista"', () => {
    expect(formatValor(197, 1970, 'YEARLY', 'BOLETO')).toBe('R$ 1970,00 à vista')
  })

  it('null em preço → formata como 0,00 sem crashar', () => {
    expect(formatValor(null, null, 'MONTHLY', 'PIX')).toBe('R$ 0,00/mês')
  })
})

describe('formatDataBR', () => {
  it('formata Date para DD/MM/AAAA em UTC', () => {
    const date = new Date('2026-04-20T12:00:00Z')
    expect(formatDataBR(date)).toBe('20/04/2026')
  })

  it('padEstro dia/mês para início de ano', () => {
    const date = new Date('2026-01-01T12:00:00Z')
    expect(formatDataBR(date)).toBe('01/01/2026')
  })

  it('retorna "-" para null', () => {
    expect(formatDataBR(null)).toBe('-')
  })
})

describe('formatMetodo', () => {
  it('PIX → "PIX"', () => {
    expect(formatMetodo('PIX')).toBe('PIX')
  })

  it('BOLETO → "Boleto"', () => {
    expect(formatMetodo('BOLETO')).toBe('Boleto')
  })

  it('CREDIT_CARD → "Cartão de crédito"', () => {
    expect(formatMetodo('CREDIT_CARD')).toBe('Cartão de crédito')
  })

  it('null → "-"', () => {
    expect(formatMetodo(null)).toBe('-')
  })

  it('método desconhecido → pass-through do próprio valor', () => {
    expect(formatMetodo('UNKNOWN_METHOD')).toBe('UNKNOWN_METHOD')
  })
})

describe('getFirstName', () => {
  it('retorna primeiro nome de um nome composto', () => {
    expect(getFirstName('Lucas Silveira')).toBe('Lucas')
  })

  it('retorna primeiro nome de um nome com 3+ partes', () => {
    expect(getFirstName('Lucas Pedro Silveira')).toBe('Lucas')
  })

  it('retorna a palavra inteira se só 1 palavra', () => {
    expect(getFirstName('Lucas')).toBe('Lucas')
  })

  it('null → "Olá"', () => {
    expect(getFirstName(null)).toBe('Olá')
  })

  it('string vazia → "Olá"', () => {
    expect(getFirstName('')).toBe('Olá')
  })
})

describe('buildParamsForState', () => {
  const trialEnds = new Date('2026-04-27T12:00:00Z')

  const makeTenant = (overrides: Record<string, unknown> = {}) => ({
    tradeName: null,
    name: 'Tenant XYZ',
    trialEndsAt: trialEnds,
    planCycle: 'MONTHLY' as string | null,
    preferredPaymentMethod: 'PIX' as string | null,
    plan: { name: 'Essencial', priceMonthly: 197, priceYearly: 1970 },
    ...overrides,
  })

  const owner = { name: 'Lucas Silveira' }

  it('TRIAL_D7_SENT: 7 chaves + diasRestantes=7 + linkPlano', () => {
    const params = buildParamsForState('TRIAL_D7_SENT', makeTenant(), owner)
    expect(params).toEqual({
      nome: 'Lucas',
      plano: 'Essencial',
      valor: 'R$ 197,00/mês',
      metodoPagamento: 'PIX',
      dataVencimento: '27/04/2026',
      diasRestantes: 7,
      linkPlano: 'https://app.tribocrm.com.br/gestao/assinatura',
    })
  })

  it('TRIAL_D3_SENT: diasRestantes=3', () => {
    const params = buildParamsForState('TRIAL_D3_SENT', makeTenant(), owner)
    expect(params.diasRestantes).toBe(3)
    expect(params.linkPlano).toBe('https://app.tribocrm.com.br/gestao/assinatura')
  })

  it('TRIAL_D1_SENT: diasRestantes=1', () => {
    const params = buildParamsForState('TRIAL_D1_SENT', makeTenant(), owner)
    expect(params.diasRestantes).toBe(1)
  })

  it('OVERDUE_D0_SENT: 6 chaves com linkPagamento (sem diasRestantes/linkPlano)', () => {
    const params = buildParamsForState('OVERDUE_D0_SENT', makeTenant(), owner)
    expect(params).toEqual({
      nome: 'Lucas',
      plano: 'Essencial',
      valor: 'R$ 197,00/mês',
      metodoPagamento: 'PIX',
      dataVencimento: '27/04/2026',
      linkPagamento: 'https://app.tribocrm.com.br/gestao/assinatura',
    })
    expect(params).not.toHaveProperty('diasRestantes')
    expect(params).not.toHaveProperty('linkPlano')
  })

  it('OVERDUE_D7_SENT: 5 chaves (nome/valor/dataVencimento/linkPagamento/linkContato)', () => {
    const params = buildParamsForState('OVERDUE_D7_SENT', makeTenant(), owner)
    expect(params).toEqual({
      nome: 'Lucas',
      valor: 'R$ 197,00/mês',
      dataVencimento: '27/04/2026',
      linkPagamento: 'https://app.tribocrm.com.br/gestao/assinatura',
      linkContato: 'https://app.tribocrm.com.br/gestao/assinatura',
    })
    expect(params).not.toHaveProperty('plano')
    expect(params).not.toHaveProperty('metodoPagamento')
  })

  it('SUSPENDED_D10_SENT: mesmo shape do D7', () => {
    const params = buildParamsForState('SUSPENDED_D10_SENT', makeTenant(), owner)
    expect(params).toEqual({
      nome: 'Lucas',
      valor: 'R$ 197,00/mês',
      dataVencimento: '27/04/2026',
      linkPagamento: 'https://app.tribocrm.com.br/gestao/assinatura',
      linkContato: 'https://app.tribocrm.com.br/gestao/assinatura',
    })
  })
})
