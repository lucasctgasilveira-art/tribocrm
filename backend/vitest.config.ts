// Config mínima do Vitest.
// - globals:true expõe describe/it/expect sem import em cada arquivo.
// - environment:'node' é o runtime do backend (sem jsdom).
// - include cobre tanto colocation (*.test.ts ao lado do arquivo real)
//   quanto a pasta __tests__/ usada pelo smoke test da 6K.1.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10_000,
  },
})
