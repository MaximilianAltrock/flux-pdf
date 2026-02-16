import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from './helpers/pdf-fixtures'

test.use({
  viewport: { width: 390, height: 844 },
})

async function getMobilePageCount(page: Page): Promise<number> {
  return page.locator('main [data-page-id]').count()
}

test('mobile smoke flow: core action navigation path', async ({ page }, testInfo) => {
  const fixturePath = await createPdfFixture(testInfo, {
    pages: 1,
    prefix: 'mobile-smoke',
  })

  await page.goto('/')
  await page.getByRole('button', { name: /^New$/ }).first().click()
  await expect(page).toHaveURL(/\/project\/.+/)

  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('heading', { name: 'Add Pages' })).toBeVisible()
  await page.getByRole('button', { name: 'Browse Files' }).click()
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  await expect.poll(async () => getMobilePageCount(page)).toBe(1)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByText('Document Info')).toBeVisible()
  await page.getByRole('button', { name: 'Document Details' }).click()
  await expect(page.locator('#metadata-title')).toBeVisible()
  await page.locator('#metadata-title').fill('Mobile Smoke Metadata')
  await expect(page.locator('#metadata-title')).toHaveValue('Mobile Smoke Metadata')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Select' }).click()
  await page.locator('main [data-mobile-page-id]').first().click()
  await expect(page.getByText('1 selected')).toBeVisible()

  await page.getByRole('button', { name: 'Copy' }).click()
  await expect.poll(async () => getMobilePageCount(page)).toBe(2)

  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => getMobilePageCount(page)).toBe(1)

  await page.getByRole('button', { name: 'Redo' }).click()
  await expect.poll(async () => getMobilePageCount(page)).toBe(2)

  await page.getByRole('button', { name: 'Export options' }).click()
  await expect(page.getByText('Export PDF')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
})
