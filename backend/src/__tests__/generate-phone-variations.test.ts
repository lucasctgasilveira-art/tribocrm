/// <reference types="vitest/globals" />
// Cobre os casos do Brasil que justificam a função: nono dígito do
// celular (DDD + 9 vs DDD), DDI 55 opcional, e máscaras variadas.

import { generatePhoneVariations } from '../controllers/leads.controller'

describe('generatePhoneVariations', () => {
  it('celular 11 dígitos com nono dígito gera versão sem o 9', () => {
    const out = generatePhoneVariations('33999317423')
    expect(out).toContain('33999317423')      // original
    expect(out).toContain('3399317423')       // sem o 9
    expect(out).toContain('5533999317423')    // com 55
    expect(out).toContain('553399317423')     // sem 9 com 55
  })

  it('telefone 10 dígitos sem o 9 gera versão com o 9 inserido', () => {
    const out = generatePhoneVariations('3399317423')
    expect(out).toContain('3399317423')       // original
    expect(out).toContain('33999317423')      // com 9 inserido
    expect(out).toContain('553399317423')     // com 55
    expect(out).toContain('5533999317423')    // com 9 e com 55
  })

  it('aceita entrada com máscara e ignora não-dígitos', () => {
    const out1 = generatePhoneVariations('+55 (33) 9931-7423')
    const out2 = generatePhoneVariations('33999317423')
    // Versão "+55 33 9931-7423" tem 12 dígitos: 553399317423.
    // Após tirar 55, sobra 3399317423 (10 dígitos) → gera com 9.
    expect(out1).toContain('33999317423')
    expect(out1).toContain('3399317423')
    expect(out2).toContain('33999317423')
    expect(out2).toContain('3399317423')
  })

  it('entrada com 55 já presente normaliza removendo o DDI antes de variar', () => {
    const out = generatePhoneVariations('5533999317423')
    expect(out).toContain('33999317423')
    expect(out).toContain('3399317423')
    expect(out).toContain('5533999317423')
    expect(out).toContain('553399317423')
  })

  it('cenário do print do Lucas: cadastro com 9, busca sem 9 — bate', () => {
    // Cadastrado: "(33) 99931-7423" → dígitos "33999317423"
    // Vendedor digita: "+55 33 9931-7423" → dígitos "553399317423"
    // (sem o 9 extra). A interseção das duas listas precisa existir.
    const cadastro = generatePhoneVariations('33999317423')
    const digitado = generatePhoneVariations('553399317423')
    const intersect = cadastro.filter(v => digitado.includes(v))
    expect(intersect.length).toBeGreaterThan(0)
  })

  it('retorna array vazio pra entrada inválida', () => {
    expect(generatePhoneVariations('')).toEqual([])
    expect(generatePhoneVariations('abc')).toEqual([])
    expect(generatePhoneVariations('123')).toEqual(['123'])
  })

  it('não duplica entradas (Set internamente)', () => {
    const out = generatePhoneVariations('33999317423')
    const dedup = Array.from(new Set(out))
    expect(out.length).toBe(dedup.length)
  })
})
