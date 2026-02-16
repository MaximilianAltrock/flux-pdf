import { writeFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TestInfo } from '@playwright/test'

type PdfFixtureOptions = {
  pages?: number
  prefix?: string
}

export async function createPdfFixture(
  testInfo: TestInfo,
  options: PdfFixtureOptions = {},
): Promise<string> {
  const pageCount = options.pages ?? 1
  const prefix = options.prefix ?? 'fixture'
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([612, 792])
    page.drawText(`FluxPDF E2E Fixture ${index + 1}`, {
      x: 72,
      y: 720,
      size: 24,
      font,
      color: rgb(0.1, 0.1, 0.1),
    })
  }

  const bytes = await pdf.save()
  const filePath = testInfo.outputPath(`${prefix}-${pageCount}p.pdf`)
  await writeFile(filePath, Buffer.from(bytes))
  return filePath
}
