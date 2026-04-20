/// <reference types="vitest/globals" />
// Smoke test da infra Vitest — prova que:
// - Vitest roda no backend
// - TypeScript compila corretamente
// - Globals (describe, it, expect) estão acessíveis
// Não testa NADA do código de aplicação nesta sub-etapa.

describe('Smoke: Vitest infra', () => {
  it('roda testes em TypeScript', () => {
    expect(1 + 1).toBe(2)
  })

  it('suporta async/await', async () => {
    const result = await Promise.resolve(42)
    expect(result).toBe(42)
  })
})
