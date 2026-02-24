import { test, expect } from '@playwright/test'

test('user can generate dataset and see KPI cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Test Case Intelligence Platform/i })).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: 'Generate 10,000 Synthetic Tests' }).click()
  await expect(page.getByText(/Loaded 10,000 tests|Generated 10,000 synthetic/i)).toBeVisible({ timeout: 30000 })
  await expect(page.getByText('Redundancy Score')).toBeVisible()
  await expect(page.getByText('Entropy Score')).toBeVisible()
})
