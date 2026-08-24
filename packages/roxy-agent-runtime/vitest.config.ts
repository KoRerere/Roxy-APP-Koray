import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Coverage is configured but the threshold gate is intentionally DISABLED during
    // the skeleton phase (interfaces + stubs only). Re-enable the 90/85 gate once
    // implementation phases begin.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/debug/**'],
      // thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
