import { PDFDocument } from 'pdf-lib'

export interface ConversionResult {
  success: boolean
  file?: File
  error?: string
}

/**
 * Composable for converting files (images) to PDF format
 */
export function useConverter() {
  /**
   * Convert an image File (PNG/JPG) to a single-page PDF File
   */
  async function convertImageToPdf(file: File): Promise<ConversionResult> {
    try {
      // 1. Create a new PDF Document
      const pdfDoc = await PDFDocument.create()
      const arrayBuffer = await file.arrayBuffer()

      // 2. Embed the image
      let image
      const filename = file.name.toLowerCase()

      if (file.type === 'image/jpeg' || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        image = await pdfDoc.embedJpg(arrayBuffer)
      } else if (file.type === 'image/png' || filename.endsWith('.png')) {
        image = await pdfDoc.embedPng(arrayBuffer)
      } else {
        throw new Error('Unsupported image format. Use JPG or PNG.')
      }

      // 3. Draw image on page matching its dimensions
      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      })

      // 4. Save as PDF bytes
      const pdfBytes = await pdfDoc.save()

      // 5. Convert back to a File object
      // We append .pdf to the original name so "photo.jpg" becomes "photo.jpg.pdf"
      // The FileHandler title logic handles stripping extensions later.
      const pdfFile = new File([pdfBytes as BlobPart], `${file.name}.pdf`, {
        type: 'application/pdf',
      })

      return { success: true, file: pdfFile }
    } catch (error) {
      console.error('Image conversion error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert image',
      }
    }
  }

  return {
    convertImageToPdf,
  }
}
