/// <reference types="vitest/globals" />

import {
  isValidPeriodReference,
  getMonthsInPeriod,
  buildPeriodReferenceFromMonth,
} from '../lib/periodReference'

describe('isValidPeriodReference', () => {
  describe('MONTHLY', () => {
    it('aceita "YYYY-MM" válido', () => {
      expect(isValidPeriodReference('MONTHLY', '2026-05')).toBe(true)
      expect(isValidPeriodReference('MONTHLY', '2026-01')).toBe(true)
      expect(isValidPeriodReference('MONTHLY', '2026-12')).toBe(true)
    })

    it('rejeita mês fora do range 1-12', () => {
      expect(isValidPeriodReference('MONTHLY', '2026-00')).toBe(false)
      expect(isValidPeriodReference('MONTHLY', '2026-13')).toBe(false)
    })

    it('rejeita formatos errados', () => {
      expect(isValidPeriodReference('MONTHLY', '2026/05')).toBe(false)
      expect(isValidPeriodReference('MONTHLY', '26-05')).toBe(false)
      expect(isValidPeriodReference('MONTHLY', '2026-5')).toBe(false)
      expect(isValidPeriodReference('MONTHLY', 'abc')).toBe(false)
      expect(isValidPeriodReference('MONTHLY', '')).toBe(false)
    })
  })

  describe('QUARTERLY', () => {
    it('aceita Q1-Q4 válidos', () => {
      expect(isValidPeriodReference('QUARTERLY', '2026-Q1')).toBe(true)
      expect(isValidPeriodReference('QUARTERLY', '2026-Q4')).toBe(true)
    })
    it('rejeita Q5 ou Q0', () => {
      expect(isValidPeriodReference('QUARTERLY', '2026-Q5')).toBe(false)
      expect(isValidPeriodReference('QUARTERLY', '2026-Q0')).toBe(false)
    })
  })

  describe('SEMESTRAL', () => {
    it('aceita S1 e S2', () => {
      expect(isValidPeriodReference('SEMESTRAL', '2026-S1')).toBe(true)
      expect(isValidPeriodReference('SEMESTRAL', '2026-S2')).toBe(true)
    })
    it('rejeita S3 ou S0', () => {
      expect(isValidPeriodReference('SEMESTRAL', '2026-S3')).toBe(false)
      expect(isValidPeriodReference('SEMESTRAL', '2026-S0')).toBe(false)
    })
  })

  describe('YEARLY', () => {
    it('aceita "YYYY"', () => {
      expect(isValidPeriodReference('YEARLY', '2026')).toBe(true)
    })
    it('rejeita formatos errados', () => {
      expect(isValidPeriodReference('YEARLY', '26')).toBe(false)
      expect(isValidPeriodReference('YEARLY', '2026-05')).toBe(false)
    })
  })
})

describe('getMonthsInPeriod', () => {
  it('MONTHLY retorna o próprio mês', () => {
    expect(getMonthsInPeriod('MONTHLY', '2026-05')).toEqual(['2026-05'])
  })

  it('QUARTERLY retorna os 3 meses do trimestre', () => {
    expect(getMonthsInPeriod('QUARTERLY', '2026-Q1')).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(getMonthsInPeriod('QUARTERLY', '2026-Q2')).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(getMonthsInPeriod('QUARTERLY', '2026-Q3')).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(getMonthsInPeriod('QUARTERLY', '2026-Q4')).toEqual(['2026-10', '2026-11', '2026-12'])
  })

  it('SEMESTRAL retorna os 6 meses do semestre', () => {
    expect(getMonthsInPeriod('SEMESTRAL', '2026-S1')).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ])
    expect(getMonthsInPeriod('SEMESTRAL', '2026-S2')).toEqual([
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ])
  })

  it('YEARLY retorna os 12 meses do ano', () => {
    const months = getMonthsInPeriod('YEARLY', '2026')
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-01')
    expect(months[11]).toBe('2026-12')
  })

  it('retorna [] pra periodReference inválido', () => {
    expect(getMonthsInPeriod('MONTHLY', 'lixo')).toEqual([])
    expect(getMonthsInPeriod('QUARTERLY', '2026-Q5')).toEqual([])
    expect(getMonthsInPeriod('YEARLY', '26')).toEqual([])
  })
})

describe('buildPeriodReferenceFromMonth', () => {
  it('mês de Q1 → quarterly Q1', () => {
    expect(buildPeriodReferenceFromMonth('2026-02')).toEqual({
      monthly: '2026-02',
      quarterly: '2026-Q1',
      semestral: '2026-S1',
      yearly: '2026',
    })
  })

  it('mês de Q2 → quarterly Q2', () => {
    expect(buildPeriodReferenceFromMonth('2026-05')).toEqual({
      monthly: '2026-05',
      quarterly: '2026-Q2',
      semestral: '2026-S1',
      yearly: '2026',
    })
  })

  it('mês de Q4 / S2', () => {
    expect(buildPeriodReferenceFromMonth('2026-11')).toEqual({
      monthly: '2026-11',
      quarterly: '2026-Q4',
      semestral: '2026-S2',
      yearly: '2026',
    })
  })

  it('retorna null pra entrada inválida', () => {
    expect(buildPeriodReferenceFromMonth('lixo')).toBeNull()
    expect(buildPeriodReferenceFromMonth('2026-13')).toBeNull()
  })
})
