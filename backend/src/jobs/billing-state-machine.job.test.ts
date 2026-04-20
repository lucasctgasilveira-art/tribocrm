/// <reference types="vitest/globals" />
// Unit tests do billing-state-machine.
// 6K.2 — funções puras (formatters, daysUntil, buildParamsForState).
// 6K.3a — TRIAL lane de runBillingStateMachineJob com mocks de
//         Prisma / mailer / efi.service.

import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

vi.mock('../lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

vi.mock('../services/mailer.service', () => ({
  sendTemplateMail: vi.fn(),
}))

vi.mock('../services/efi.service', () => ({
  createPixCharge: vi.fn(),
  createBoletoCharge: vi.fn(),
}))

import { prisma } from '../lib/prisma'
import { sendTemplateMail } from '../services/mailer.service'
import { createPixCharge, createBoletoCharge } from '../services/efi.service'
import {
  daysUntil,
  formatValor,
  formatDataBR,
  formatMetodo,
  getFirstName,
  buildParamsForState,
  runBillingStateMachineJob,
} from './billing-state-machine.job'

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
const sendMock = sendTemplateMail as unknown as ReturnType<typeof vi.fn>
const pixMock = createPixCharge as unknown as ReturnType<typeof vi.fn>
const boletoMock = createBoletoCharge as unknown as ReturnType<typeof vi.fn>

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

// ─────────────────────────────────────────────────────────────
// 6K.3a — runBillingStateMachineJob (TRIAL lane + skip guards)
// ─────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  name: string
  tradeName: string | null
  cnpj: string
  document: string | null
  status: 'TRIAL' | 'ACTIVE' | 'PAYMENT_OVERDUE' | 'SUSPENDED' | 'CANCELLED'
  trialEndsAt: Date | null
  planCycle: 'MONTHLY' | 'YEARLY' | null
  preferredPaymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | null
  addressStreet: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
  lastBillingState: string | null
  plan: { name: string; priceMonthly: unknown; priceYearly: unknown } | null
  users: Array<{ id: string; name: string; email: string }>
}

function makeTenant(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: 'tenant-1',
    name: 'Tenant XYZ',
    tradeName: null,
    cnpj: '12345678000199',
    document: null,
    status: 'TRIAL',
    trialEndsAt: new Date('2026-04-27T12:00:00Z'),
    planCycle: 'MONTHLY',
    preferredPaymentMethod: 'PIX',
    addressStreet: 'Rua X',
    addressCity: 'SP',
    addressState: 'SP',
    addressZip: '01000000',
    lastBillingState: null,
    plan: { name: 'Essencial', priceMonthly: 197, priceYearly: 1970 },
    users: [{ id: 'u-1', name: 'Lucas Silveira', email: 'owner@example.com' }],
    ...overrides,
  }
}

describe('runBillingStateMachineJob — TRIAL lane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))

    sendMock.mockResolvedValue({ sent: true })
    prismaMock.charge.findFirst.mockResolvedValue(null as any)
    prismaMock.tenant.updateMany.mockResolvedValue({ count: 1 } as any)

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('D-7 fresh', () => {
    it('envia template 2 e marca TRIAL_D7_SENT', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-27T12:00:00Z'),
        lastBillingState: null,
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        to: 'owner@example.com',
        templateId: 2,
        params: expect.objectContaining({
          nome: 'Lucas',
          diasRestantes: 7,
        }),
      }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'tenant-1',
          status: { in: ['TRIAL', 'PAYMENT_OVERDUE', 'SUSPENDED'] },
        },
        data: expect.objectContaining({
          lastBillingState: 'TRIAL_D7_SENT',
          status: 'TRIAL',
        }),
      })
      expect(pixMock).not.toHaveBeenCalled()
      expect(boletoMock).not.toHaveBeenCalled()
    })
  })

  describe('D-3 fresh', () => {
    it('com PIX: cria charge PIX + envia template 3', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-23T12:00:00Z'),
        preferredPaymentMethod: 'PIX',
        lastBillingState: null,
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)
      pixMock.mockResolvedValue({ txid: 'pix-123' } as any)

      await runBillingStateMachineJob()

      expect(prismaMock.charge.findFirst).toHaveBeenCalled()
      expect(pixMock).toHaveBeenCalledTimes(1)
      expect(boletoMock).not.toHaveBeenCalled()
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 3,
      }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastBillingState: 'TRIAL_D3_SENT' }),
        }),
      )
    })

    it('com BOLETO: cria charge Boleto + envia template 3', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-23T12:00:00Z'),
        preferredPaymentMethod: 'BOLETO',
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)
      boletoMock.mockResolvedValue({ chargeId: 'boleto-456' } as any)

      await runBillingStateMachineJob()

      expect(boletoMock).toHaveBeenCalledTimes(1)
      expect(pixMock).not.toHaveBeenCalled()
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 3,
      }))
    })

    it('com charge PENDING existente: não cria nova, envia email', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-23T12:00:00Z'),
        preferredPaymentMethod: 'PIX',
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)
      prismaMock.charge.findFirst.mockResolvedValue({ id: 'existing-charge' } as any)

      await runBillingStateMachineJob()

      expect(pixMock).not.toHaveBeenCalled()
      expect(boletoMock).not.toHaveBeenCalled()
      expect(sendMock).toHaveBeenCalled()
    })

    it('sem preferredPaymentMethod: pula charge, envia email', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-23T12:00:00Z'),
        preferredPaymentMethod: null,
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(pixMock).not.toHaveBeenCalled()
      expect(boletoMock).not.toHaveBeenCalled()
      expect(sendMock).toHaveBeenCalled()
    })
  })

  describe('D-1 fresh', () => {
    it('envia template 4 e marca TRIAL_D1_SENT', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-21T12:00:00Z'),
        lastBillingState: null,
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 4,
        params: expect.objectContaining({ diasRestantes: 1 }),
      }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastBillingState: 'TRIAL_D1_SENT' }),
        }),
      )
    })
  })

  describe('Idempotência', () => {
    it('tenant já com TRIAL_D7_SENT em D-7 não reenvia', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-27T12:00:00Z'),
        lastBillingState: 'TRIAL_D7_SENT',
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).not.toHaveBeenCalled()
      expect(prismaMock.tenant.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('Skip guards', () => {
    it('sem owner ativo: não envia email e preserva lastBillingState', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-27T12:00:00Z'),
        users: [],
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).not.toHaveBeenCalled()
      expect(prismaMock.tenant.updateMany).not.toHaveBeenCalled()
    })

    it('sem trialEndsAt: warn + skip sem enviar', async () => {
      const tenant = makeTenant({ trialEndsAt: null })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).not.toHaveBeenCalled()
      expect(prismaMock.tenant.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('sendTemplateMail retorna sent:false → preserva lastBillingState', async () => {
      const tenant = makeTenant({
        trialEndsAt: new Date('2026-04-27T12:00:00Z'),
        lastBillingState: null,
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)
      sendMock.mockResolvedValue({ sent: false, reason: 'brevo_down' })

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(prismaMock.tenant.updateMany).not.toHaveBeenCalled()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// 6K.3b — runBillingStateMachineJob OVERDUE + SUSPENDED + edge
// ─────────────────────────────────────────────────────────────

describe('runBillingStateMachineJob — OVERDUE / SUSPENDED / edge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))

    sendMock.mockResolvedValue({ sent: true })
    prismaMock.charge.findFirst.mockResolvedValue(null as any)
    prismaMock.tenant.updateMany.mockResolvedValue({ count: 1 } as any)

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('OVERDUE lane', () => {
    it('D+0 fresh: trial expirou ontem, flipa status TRIAL → PAYMENT_OVERDUE', async () => {
      const tenant = makeTenant({
        status: 'TRIAL',
        lastBillingState: null,
        trialEndsAt: new Date('2026-04-19T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 5,
        to: 'owner@example.com',
      }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'tenant-1',
          status: { in: ['TRIAL', 'PAYMENT_OVERDUE', 'SUSPENDED'] },
        },
        data: expect.objectContaining({
          status: 'PAYMENT_OVERDUE',
          lastBillingState: 'OVERDUE_D0_SENT',
        }),
      })
    })

    it('D+0 legacy: tenant já PAYMENT_OVERDUE sem lastBillingState dispara D+0 sem flip', async () => {
      const tenant = makeTenant({
        status: 'PAYMENT_OVERDUE',
        lastBillingState: null,
        trialEndsAt: new Date('2026-04-19T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ templateId: 5 }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAYMENT_OVERDUE',
            lastBillingState: 'OVERDUE_D0_SENT',
          }),
        }),
      )
    })

    it('D+7 fresh: tenant OVERDUE_D0_SENT há 7 dias dispara OVERDUE_D7', async () => {
      const tenant = makeTenant({
        status: 'PAYMENT_OVERDUE',
        lastBillingState: 'OVERDUE_D0_SENT',
        trialEndsAt: new Date('2026-04-13T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ templateId: 6 }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAYMENT_OVERDUE',
            lastBillingState: 'OVERDUE_D7_SENT',
          }),
        }),
      )
    })

    it('Idempotência D+0: tenant OVERDUE_D0_SENT com 1 dia de atraso não reenvia', async () => {
      const tenant = makeTenant({
        status: 'PAYMENT_OVERDUE',
        lastBillingState: 'OVERDUE_D0_SENT',
        trialEndsAt: new Date('2026-04-19T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).not.toHaveBeenCalled()
      expect(prismaMock.tenant.updateMany).not.toHaveBeenCalled()
    })

    it('Idempotência D+7: tenant OVERDUE_D7_SENT com 7 dias de atraso não reenvia', async () => {
      const tenant = makeTenant({
        status: 'PAYMENT_OVERDUE',
        lastBillingState: 'OVERDUE_D7_SENT',
        trialEndsAt: new Date('2026-04-13T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).not.toHaveBeenCalled()
      expect(prismaMock.tenant.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('SUSPENDED lane', () => {
    it('D+10 fresh: tenant OVERDUE_D7_SENT há 10 dias flipa PAYMENT_OVERDUE → SUSPENDED', async () => {
      const tenant = makeTenant({
        status: 'PAYMENT_OVERDUE',
        lastBillingState: 'OVERDUE_D7_SENT',
        trialEndsAt: new Date('2026-04-10T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ templateId: 7 }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUSPENDED',
            lastBillingState: 'SUSPENDED_D10_SENT',
          }),
        }),
      )
    })
  })

  describe('Edge cases', () => {
    it('Race condition: updateMany retorna count=0 — email já foi enviado antes', async () => {
      const tenant = makeTenant({
        status: 'TRIAL',
        lastBillingState: null,
        trialEndsAt: new Date('2026-04-19T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)
      prismaMock.tenant.updateMany.mockResolvedValue({ count: 0 } as any)

      await runBillingStateMachineJob()

      // Email foi enviado ANTES do updateMany — ordem intencional
      // pra não bloquear notificação caso UPDATE race.
      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledTimes(1)
    })

    it('Legacy TRIAL_EXPIRED: tenant com marker antigo entra no branch D+0', async () => {
      const tenant = makeTenant({
        status: 'TRIAL',
        lastBillingState: 'TRIAL_EXPIRED',
        trialEndsAt: new Date('2026-04-15T12:00:00Z'),
      })
      prismaMock.tenant.findMany.mockResolvedValue([tenant] as any)

      await runBillingStateMachineJob()

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ templateId: 5 }))
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastBillingState: 'OVERDUE_D0_SENT',
          }),
        }),
      )
    })
  })
})
