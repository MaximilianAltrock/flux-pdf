import { expect, test } from '@playwright/test'
import { createPdfBytes } from '../helpers/pdf-fixtures'

test('imports a PDF and shows it in the source list', async ({ page }) => {
  await page.goto('/')

  const pdfBytes = await createPdfBytes(2)
  const fileInput = page.locator('input[type="file"][accept*="image"]')

  await fileInput.setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdfBytes),
  })

  await expect(page.getByText('sample.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText('2p', { exact: true })).toBeVisible()
})
