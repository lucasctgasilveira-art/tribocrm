/// <reference types="vitest/globals" />
// Cobre a regra de rampagem (Documento de Requisitos seções 6.3, 6.9, 13.7).
// Função pura — esses testes são suficientes pra validar a lógica
// sem precisar mockar prisma.

import { isUserInRamping, lastMonthCoveredByPeriod } from '../lib/ramping'

describe('isUserInRamping', () => {
  describe('vendedor sem rampingStartsAt', () => {
    it('nunca está em rampagem (entra normal em qualquer meta)', () => {
      expect(isUserInRamping(null, 'MONTHLY', '2026-05')).toBe(false)
      expect(isUserInRamping(null, 'QUARTERLY', '2026-Q2')).toBe(false)
      expect(isUserInRamping(null, 'YEARLY', '2026')).toBe(false)
    })
  })

  describe('meta MONTHLY', () => {
    const may2026 = new Date(2026, 4, 1) // mai/2026 (mês 4 = maio em zero-based)
    const jun2026 = new Date(2026, 5, 1)
    const jul2026 = new Date(2026, 6, 1)

    it('início no mesmo mês da meta: NÃO está em rampagem (entra normal)', () => {
      expect(isUserInRamping(may2026, 'MONTHLY', '2026-05')).toBe(false)
    })

    it('início em mês ANTERIOR: NÃO está em rampagem', () => {
      expect(isUserInRamping(may2026, 'MONTHLY', '2026-06')).toBe(false)
    })

    it('início em mês POSTERIOR: ESTÁ em rampagem', () => {
      expect(isUserInRamping(jul2026, 'MONTHLY', '2026-05')).toBe(true)
      expect(isUserInRamping(jun2026, 'MONTHLY', '2026-05')).toBe(true)
    })

    it('comparação atravessa virada de ano corretamente', () => {
      const jan2027 = new Date(2027, 0, 1)
      expect(isUserInRamping(jan2027, 'MONTHLY', '2026-12')).toBe(true)
      expect(isUserInRamping(jan2027, 'MONTHLY', '2027-01')).toBe(false)
    })
  })

  describe('meta QUARTERLY', () => {
    const apr2026 = new Date(2026, 3, 1) // abril
    const jun2026 = new Date(2026, 5, 1) // junho (último de Q2)
    const jul2026 = new Date(2026, 6, 1) // julho (primeiro de Q3)

    it('início dentro do trimestre (mas não primeiro mês): NÃO em rampagem', () => {
      // Q2 = abr-mai-jun. Início em jun → ainda dentro → não em rampagem
      expect(isUserInRamping(jun2026, 'QUARTERLY', '2026-Q2')).toBe(false)
    })

    it('início no primeiro mês do trimestre: NÃO em rampagem', () => {
      expect(isUserInRamping(apr2026, 'QUARTERLY', '2026-Q2')).toBe(false)
    })

    it('início após último mês do trimestre: ESTÁ em rampagem', () => {
      // Início em jul → Q2 termina em jun → está em rampagem
      expect(isUserInRamping(jul2026, 'QUARTERLY', '2026-Q2')).toBe(true)
    })

    it('Q1 inclui jan-fev-mar', () => {
      const mar2026 = new Date(2026, 2, 1)
      const apr2026Local = new Date(2026, 3, 1)
      expect(isUserInRamping(mar2026, 'QUARTERLY', '2026-Q1')).toBe(false)
      expect(isUserInRamping(apr2026Local, 'QUARTERLY', '2026-Q1')).toBe(true)
    })

    it('Q4 inclui out-nov-dez', () => {
      const dec2026 = new Date(2026, 11, 1)
      const jan2027 = new Date(2027, 0, 1)
      expect(isUserInRamping(dec2026, 'QUARTERLY', '2026-Q4')).toBe(false)
      expect(isUserInRamping(jan2027, 'QUARTERLY', '2026-Q4')).toBe(true)
    })

    it('periodReference malformado: trata como sem rampagem (fail-safe)', () => {
      const jul2026Local = new Date(2026, 6, 1)
      expect(isUserInRamping(jul2026Local, 'QUARTERLY', '2026-Q5')).toBe(false)
      expect(isUserInRamping(jul2026Local, 'QUARTERLY', 'lixo')).toBe(false)
    })
  })

  describe('meta YEARLY', () => {
    const jun2026 = new Date(2026, 5, 1)
    const jan2027 = new Date(2027, 0, 1)

    it('início no mesmo ano: NÃO em rampagem', () => {
      expect(isUserInRamping(jun2026, 'YEARLY', '2026')).toBe(false)
    })

    it('início no ano seguinte: ESTÁ em rampagem', () => {
      expect(isUserInRamping(jan2027, 'YEARLY', '2026')).toBe(true)
    })
  })
})

describe('lastMonthCoveredByPeriod', () => {
  it('MONTHLY retorna o próprio periodReference', () => {
    expect(lastMonthCoveredByPeriod('MONTHLY', '2026-05')).toBe('2026-05')
  })

  it('QUARTERLY retorna último mês do trimestre', () => {
    expect(lastMonthCoveredByPeriod('QUARTERLY', '2026-Q1')).toBe('2026-03')
    expect(lastMonthCoveredByPeriod('QUARTERLY', '2026-Q2')).toBe('2026-06')
    expect(lastMonthCoveredByPeriod('QUARTERLY', '2026-Q3')).toBe('2026-09')
    expect(lastMonthCoveredByPeriod('QUARTERLY', '2026-Q4')).toBe('2026-12')
  })

  it('YEARLY retorna dezembro do ano', () => {
    expect(lastMonthCoveredByPeriod('YEARLY', '2026')).toBe('2026-12')
  })

  it('formato inválido retorna null', () => {
    expect(lastMonthCoveredByPeriod('MONTHLY', '2026/05')).toBeNull()
    expect(lastMonthCoveredByPeriod('QUARTERLY', '2026-Q5')).toBeNull()
    expect(lastMonthCoveredByPeriod('YEARLY', '26')).toBeNull()
  })
})
