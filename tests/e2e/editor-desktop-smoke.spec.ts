import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from './helpers/pdf-fixtures'

async function getMainGridPageIds(page: Page): Promise<string[]> {
  return page.locator('main [data-page-id]').evaluateAll((nodes) => {
    return nodes
      .map((node) => node.getAttribute('data-page-id') ?? '')
      .filter((id) => id.length > 0)
  })
}

test('desktop smoke flow: import, reorder, metadata, undo/redo, export', async ({
  page,
}, testInfo) => {
  const fixturePath = await createPdfFixture(testInfo, {
    pages: 2,
    prefix: 'desktop-smoke',
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'New Project' }).first().click()
  await expect(page).toHaveURL(/\/project\/.+/)

  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  await expect.poll(async () => (await getMainGridPageIds(page)).length).toBe(2)

  const initialOrder = await getMainGridPageIds(page)
  expect(initialOrder).toHaveLength(2)

  const gridItems = page.locator('main [data-grid-item="page"]')
  await gridItems.nth(1).dragTo(gridItems.nth(0), {
    targetPosition: { x: 4, y: 20 },
  })

  await expect
    .poll(async () => {
      const ids = await getMainGridPageIds(page)
      return ids[0]
    })
    .toBe(initialOrder[1])

  await page.getByRole('tab', { name: 'Metadata' }).click()
  const metadataTitle = page.locator('#metadata-title')
  await metadataTitle.fill('Desktop Smoke Metadata')
  await expect(metadataTitle).toHaveValue('Desktop Smoke Metadata')

  await page.locator('main [data-page-id]').first().click()
  await page.keyboard.press('ControlOrMeta+KeyZ')
  await expect
    .poll(async () => {
      const ids = await getMainGridPageIds(page)
      return ids[0]
    })
    .toBe(initialOrder[0])

  await page.keyboard.press('ControlOrMeta+Shift+KeyZ')
  await expect
    .poll(async () => {
      const ids = await getMainGridPageIds(page)
      return ids[0]
    })
    .toBe(initialOrder[1])

  await page.getByRole('button', { name: /^Export$/ }).first().click()
  const exportDialog = page.getByRole('dialog')
  await expect(exportDialog.getByText('Export PDF')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await exportDialog.getByRole('button', { name: /^Export/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename().toLowerCase()).toContain('.pdf')
})
