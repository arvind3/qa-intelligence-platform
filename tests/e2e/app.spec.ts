import { test, expect } from '@playwright/test'

test('user can generate unified schema records and see progress', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /QualiGraph/i })).toBeVisible({ timeout: 30000 })

  const generateBtn = page.getByRole('button', { name: /Generate 10,000 Unified Schema Records/i })
  await generateBtn.click()

  await expect(page.getByRole('button', { name: /Generating\.\.\./i })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Loaded 10,000 tests from synthetic unified schema generator/i)).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: /Download Complete Schema Bundle/i })).toBeEnabled()
})

test('all chart and cluster panels render after generation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Generate 10,000 Unified Schema Records/i }).click()
  await expect(page.getByText(/Loaded 10,000 tests from synthetic unified schema generator/i)).toBeVisible({ timeout: 30000 })

  const panelTitles = [
    'Semantic Cluster Map (Test Cases)',
    'Suite Distribution (DuckDB)',
    'Requirement / Test / Defect Coverage by Feature',
    'Execution Outcome Mix',
    'Consolidated Relationship Flow (Plan → Suite → Defects)',
    'Requirement Cluster Map',
    'Defect Cluster Map',
    'Unified Cluster Map',
    'Requirement Coverage Heatmap',
    'Defect Leakage Funnel',
    'Execution Reliability by Plan',
    'Traceability Completeness',
    'Sample Unified Schema Records',
  ]

  for (const title of panelTitles) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30000 })
  }
})
