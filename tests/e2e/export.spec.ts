import { expect, test } from '@playwright/test'
import { createPdfBytes } from '../helpers/pdf-fixtures'

test('exports a PDF download from the modal', async ({ page }) => {
  await page.goto('/')

  const pdfBytes = await createPdfBytes(1)
  const fileInput = page.locator('input[type="file"][accept*="image"]')

  await fileInput.setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdfBytes),
  })

  await expect(page.getByText('sample.pdf', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByText('EXPORT PDF')).toBeVisible()

  await page.getByRole('button', { name: /System Parameters/i }).click()
  await page.getByText('Off', { exact: true }).click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Initialize/i }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})
