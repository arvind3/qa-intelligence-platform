import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: { headless: true, baseURL: 'http://127.0.0.1:4273' },
  reporter: [['list'], ['json', { outputFile: 'results/playwright-report.json' }]],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4273',
    url: 'http://127.0.0.1:4273',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
