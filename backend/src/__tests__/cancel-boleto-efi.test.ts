/// <reference types="vitest/globals" />
// Testa a propagação de cancelamento de cobranças pra Efi:
//   • cancelBoletoAtEfi   (PUT /charge/:id/cancel)
//   • cancelPixAtEfi      (PATCH /v2/cob/:txid → REMOVIDA)
//   • cancelPendingChargesForTenant (limpa órfãos ao estender trial)
// O SDK da Efi e o Prisma são mockados para não tocar rede/banco.

import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const { cancelChargeMock, pixUpdateChargeMock } = vi.hoisted(() => ({
  cancelChargeMock: vi.fn(),
  pixUpdateChargeMock: vi.fn(),
}))

vi.mock('sdk-typescript-apis-efi', () => ({
  default: class MockEfiPay {
    cancelCharge = cancelChargeMock
    pixUpdateCharge = pixUpdateChargeMock
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

import { prisma } from '../lib/prisma'
import {
  cancelBoletoAtEfi,
  cancelPixAtEfi,
  cancelPendingChargesForTenant,
} from '../services/efi.service'

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('cancelBoletoAtEfi', () => {
  it('id numérico + Efi confirma → ok:true e chama cancelCharge com o id', async () => {
    cancelChargeMock.mockResolvedValue({ code: 200 })
    const result = await cancelBoletoAtEfi('1027587951')
    expect(result).toEqual({ ok: true })
    expect(cancelChargeMock).toHaveBeenCalledWith({ id: 1027587951 })
  })

  it('Efi recusa (ex.: boleto já pago) → ok:false com a mensagem da Efi', async () => {
    cancelChargeMock.mockRejectedValue({
      response: { data: { error_description: 'charge cannot be cancelled: paid' } },
    })
    const result = await cancelBoletoAtEfi('1027587951')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('paid')
  })

  it('id não-numérico (txid PIX) → ok:false sem chamar a Efi', async () => {
    const result = await cancelBoletoAtEfi('tribo1748abcd')
    expect(result.ok).toBe(false)
    expect(cancelChargeMock).not.toHaveBeenCalled()
  })

  it('efiChargeId null → ok:false sem chamar a Efi', async () => {
    const result = await cancelBoletoAtEfi(null)
    expect(result.ok).toBe(false)
    expect(cancelChargeMock).not.toHaveBeenCalled()
  })
})

describe('cancelPixAtEfi', () => {
  it('txid válido + Efi confirma → ok:true e remove com status REMOVIDA', async () => {
    pixUpdateChargeMock.mockResolvedValue({ status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR' })
    const result = await cancelPixAtEfi('tribo1748abcd')
    expect(result).toEqual({ ok: true })
    expect(pixUpdateChargeMock).toHaveBeenCalledWith(
      { txid: 'tribo1748abcd' },
      { status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR' },
    )
  })

  it('Efi recusa → ok:false com a mensagem da Efi', async () => {
    pixUpdateChargeMock.mockRejectedValue({
      response: { data: { message: 'cob não está ativa' } },
    })
    const result = await cancelPixAtEfi('tribo1748abcd')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('não está ativa')
  })

  it('txid vazio → ok:false sem chamar a Efi', async () => {
    const result = await cancelPixAtEfi('')
    expect(result.ok).toBe(false)
    expect(pixUpdateChargeMock).not.toHaveBeenCalled()
  })
})

describe('cancelPendingChargesForTenant', () => {
  it('cancela boleto pendente confirmado na Efi e marca CANCELLED no banco', async () => {
    prismaMock.charge.findMany.mockResolvedValue([
      { id: 'c1', paymentMethod: 'BOLETO', efiChargeId: '123' },
    ] as any)
    cancelChargeMock.mockResolvedValue({ code: 200 })

    const result = await cancelPendingChargesForTenant('tenant-1')

    expect(result).toEqual({ cancelled: 1, skipped: 0 })
    expect(prismaMock.charge.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'CANCELLED' },
    })
  })

  it('se a Efi recusa, pula a cobrança e NÃO marca CANCELLED', async () => {
    prismaMock.charge.findMany.mockResolvedValue([
      { id: 'c1', paymentMethod: 'BOLETO', efiChargeId: '123' },
    ] as any)
    cancelChargeMock.mockRejectedValue({ message: 'já paga' })

    const result = await cancelPendingChargesForTenant('tenant-1')

    expect(result).toEqual({ cancelled: 0, skipped: 1 })
    expect(prismaMock.charge.update).not.toHaveBeenCalled()
  })

  it('cobrança MANUAL (sem efiChargeId) é cancelada só no banco', async () => {
    prismaMock.charge.findMany.mockResolvedValue([
      { id: 'c2', paymentMethod: 'MANUAL', efiChargeId: null },
    ] as any)

    const result = await cancelPendingChargesForTenant('tenant-1')

    expect(result).toEqual({ cancelled: 1, skipped: 0 })
    expect(cancelChargeMock).not.toHaveBeenCalled()
    expect(pixUpdateChargeMock).not.toHaveBeenCalled()
    expect(prismaMock.charge.update).toHaveBeenCalledWith({
      where: { id: 'c2' },
      data: { status: 'CANCELLED' },
    })
  })
})
