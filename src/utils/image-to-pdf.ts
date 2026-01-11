import { PDFDocument } from 'pdf-lib'

export interface ImageToPdfResult {
  success: boolean
  file?: File
  error?: string
}

/**
 * Convert a JPG/PNG image File into a single-page PDF File.
 */
export async function convertImageToPdf(file: File): Promise<ImageToPdfResult> {
  try {
    const pdfDoc = await PDFDocument.create()
    const arrayBuffer = await file.arrayBuffer()

    let image
    const filename = file.name.toLowerCase()

    if (file.type === 'image/jpeg' || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      image = await pdfDoc.embedJpg(arrayBuffer)
    } else if (file.type === 'image/png' || filename.endsWith('.png')) {
      image = await pdfDoc.embedPng(arrayBuffer)
    } else {
      throw new Error('Unsupported image format. Use JPG or PNG.')
    }

    const page = pdfDoc.addPage([image.width, image.height])
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    })

    const pdfBytes = await pdfDoc.save()
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
