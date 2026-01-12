import { PDFDocument } from 'pdf-lib'

export async function createPdfBytes(pageCount = 1): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage()
  }
  return pdfDoc.save()
}
