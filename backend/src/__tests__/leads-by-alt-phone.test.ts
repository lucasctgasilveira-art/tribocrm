/// <reference types="vitest/globals" />
// Unit test para findLeadByAltPhone (controller helper que serve a
// rota GET /leads/by-alt-phone/:phone). Testa com Prisma mockado.

import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import { findLeadByAltPhone } from '../controllers/leads.controller'

const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>()

describe('findLeadByAltPhone', () => {
  beforeEach(() => {
    prismaMock.lead.findFirst.mockReset()
  })

  it('retorna { leadId } quando lead é encontrado', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: 'lead-1' } as any)

    const result = await findLeadByAltPhone(
      prismaMock,
      'tenant-1',
      '5521999999999',
      'OWNER',
      'user-1',
    )

    expect(result).toEqual({ leadId: 'lead-1' })
    expect(prismaMock.lead.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        deletedAt: null,
        altPhones: { array_contains: '5521999999999' },
      },
      select: { id: true },
    })
  })

  it('retorna null quando nenhum lead tem o phone na lista de alt-phones', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null)

    const result = await findLeadByAltPhone(
      prismaMock,
      'tenant-1',
      '5521000000000',
      'OWNER',
      'user-1',
    )

    expect(result).toBeNull()
  })

  it('aplica sellerScope quando role é SELLER (isolamento entre vendedores)', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: 'lead-2' } as any)

    await findLeadByAltPhone(
      prismaMock,
      'tenant-1',
      '5521888888888',
      'SELLER',
      'user-seller-1',
    )

    expect(prismaMock.lead.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        deletedAt: null,
        altPhones: { array_contains: '5521888888888' },
        responsibleId: 'user-seller-1',
      },
      select: { id: true },
    })
  })

  it('NÃO aplica sellerScope quando role é OWNER/MANAGER (vê tudo do tenant)', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: 'lead-3' } as any)

    await findLeadByAltPhone(
      prismaMock,
      'tenant-1',
      '5521777777777',
      'MANAGER',
      'user-manager-1',
    )

    const call = prismaMock.lead.findFirst.mock.calls[0]?.[0]
    expect(call?.where).not.toHaveProperty('responsibleId')
  })

  it('isolamento de tenant: where.tenantId é sempre passado', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null)

    await findLeadByAltPhone(
      prismaMock,
      'tenant-A',
      '5521555555555',
      'OWNER',
      'user-1',
    )

    const call = prismaMock.lead.findFirst.mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ tenantId: 'tenant-A' })
  })
})
