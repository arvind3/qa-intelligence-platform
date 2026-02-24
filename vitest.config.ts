import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default', 'json'],
    outputFile: 'results/vitest-report.json',
  },
})
