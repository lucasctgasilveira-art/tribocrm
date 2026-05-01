/// <reference types="vitest/globals" />
// Captura a query SQL gerada por findLeadByPhone pra checar se a
// estrutura do Prisma.sql + Prisma.join esta saindo correta.

import { mockDeep } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import { findLeadByPhone } from '../controllers/leads.controller'

describe('findLeadByPhone — geração da query', () => {
  it('chama $queryRaw com Prisma.sql contendo a estrutura esperada', async () => {
    const prismaMock = mockDeep<PrismaClient>()
    prismaMock.$queryRaw.mockResolvedValue([] as any)

    await findLeadByPhone(prismaMock, 'tenant-1', '5533999317423', 'OWNER', 'user-1')

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    const calledWith = prismaMock.$queryRaw.mock.calls[0]?.[0] as any
    // Prisma.sql gera objeto com 'strings' (array) e 'values' (array)
    expect(calledWith).toBeDefined()
    expect(calledWith.strings).toBeDefined()
    expect(Array.isArray(calledWith.strings)).toBe(true)
    expect(calledWith.values).toBeDefined()
    expect(Array.isArray(calledWith.values)).toBe(true)

    // Junta o SQL pra verificar fragmentos esperados.
    // Nomes de tabela/coluna sao do Postgres (snake_case), nao do
    // model Prisma — caso contrario o erro 42P01 (relation does not
    // exist) que aconteceu em producao volta a acontecer.
    const fullSql = calledWith.strings.join('?')
    expect(fullSql).toContain('FROM leads')
    expect(fullSql).toContain('tenant_id')
    expect(fullSql).toContain('deleted_at')
    expect(fullSql).toContain('alt_phones')
    expect(fullSql).toContain('updated_at')
    expect(fullSql).toContain('regexp_replace')
    expect(fullSql).toContain('jsonb_array_elements_text')
    expect(fullSql).toContain('IN (')
    // Garante que NAO tem nomes do Prisma model em quotes
    expect(fullSql).not.toContain('"Lead"')
    expect(fullSql).not.toContain('"tenantId"')
    expect(fullSql).not.toContain('"deletedAt"')

    // Variations do "5533999317423" devem aparecer nos values:
    // ['33999317423', '3399317423', '5533999317423', '553399317423']
    const allValues = calledWith.values
    expect(allValues).toContain('33999317423')
    expect(allValues).toContain('5533999317423')
    expect(allValues).toContain('tenant-1')
  })

  it('quando role e SELLER, inclui responsibleId no filtro', async () => {
    const prismaMock = mockDeep<PrismaClient>()
    prismaMock.$queryRaw.mockResolvedValue([] as any)

    await findLeadByPhone(prismaMock, 'tenant-1', '5533999317423', 'SELLER', 'user-seller-1')

    const calledWith = prismaMock.$queryRaw.mock.calls[0]?.[0] as any
    expect(calledWith.values).toContain('user-seller-1')
  })

  it('retorna null pra entrada vazia (sem chamar query)', async () => {
    const prismaMock = mockDeep<PrismaClient>()
    const result = await findLeadByPhone(prismaMock, 'tenant-1', '', 'OWNER', 'user-1')
    expect(result).toBeNull()
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })
})
