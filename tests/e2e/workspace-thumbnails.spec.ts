import { expect, test, type Page } from '@playwright/test'
import { createPdfFixture } from './helpers/pdf-fixtures'

async function importIntoNewProject(page: Page, fixturePath: string) {
  await page.getByRole('button', { name: 'New Project' }).first().click()
  await expect(page).toHaveURL(/\/project\/.+/)
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  await expect.poll(async () => page.locator('main [data-page-id]').count()).toBeGreaterThan(0)
}

async function expectVisibleThumbnails(page: Page, count: number) {
  await expect.poll(async () => page.locator('img[alt="Thumbnail"]').count()).toBe(count)
  await expect
    .poll(async () => {
      return page.locator('img[alt="Thumbnail"]').evaluateAll((nodes) => {
        return nodes.every((node) => {
          const image = node as HTMLImageElement
          return image.complete && image.naturalWidth > 0
        })
      })
    })
    .toBe(true)
}

test('workspace thumbnails survive repeated editor navigation', async ({ page }, testInfo) => {
  const fixtureA = await createPdfFixture(testInfo, {
    pages: 1,
    prefix: 'workspace-thumb-a',
  })
  const fixtureB = await createPdfFixture(testInfo, {
    pages: 1,
    prefix: 'workspace-thumb-b',
  })

  await page.goto('/')

  await importIntoNewProject(page, fixtureA)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expectVisibleThumbnails(page, 1)

  await importIntoNewProject(page, fixtureB)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expectVisibleThumbnails(page, 2)

  await page.locator('img[alt="Thumbnail"]').first().click()
  await expect(page).toHaveURL(/\/project\/.+/)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expectVisibleThumbnails(page, 2)
})
