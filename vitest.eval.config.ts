// AI evals against a real provider: `npm run ai:eval` (see src/ai/eval/).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/ai/eval/**/*.eval.ts'],
    environment: 'node',
    testTimeout: 600_000,
    fileParallelism: false,
  },
})
