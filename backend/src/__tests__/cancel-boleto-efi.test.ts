/// <reference types="vitest/globals" />
// Testa cancelBoletoAtEfi: propagação do cancelamento de boleto pra Efi.
// O SDK da Efi é mockado para não tocar a rede; validamos que o helper
// chama cancelCharge com o id numérico, trata sucesso/erro e rejeita
// ids não-numéricos sem chamar a Efi.

import { mockDeep } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const { cancelChargeMock } = vi.hoisted(() => ({ cancelChargeMock: vi.fn() }))

vi.mock('sdk-typescript-apis-efi', () => ({
  default: class MockEfiPay {
    cancelCharge = cancelChargeMock
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

import { cancelBoletoAtEfi } from '../services/efi.service'

describe('cancelBoletoAtEfi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

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
