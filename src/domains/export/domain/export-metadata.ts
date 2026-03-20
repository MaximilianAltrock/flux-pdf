import type { PDFDocument } from 'pdf-lib'
import type { ExportMetadata } from '@/domains/export/domain/export-types'

export function normalizeExportMetadata(metadata?: ExportMetadata): ExportMetadata | null {
  if (!metadata) return null

  const title = typeof metadata.title === 'string' ? metadata.title.trim() : ''
  const author = typeof metadata.author === 'string' ? metadata.author.trim() : ''
  const subject = typeof metadata.subject === 'string' ? metadata.subject.trim() : ''
  const keywords = Array.isArray(metadata.keywords)
    ? metadata.keywords.map((keyword) => keyword.trim()).filter(Boolean)
    : []
  const creator = metadata.creator?.trim()
  const producer = metadata.producer?.trim()

  if (!title && !author && !subject && keywords.length === 0 && !creator && !producer) {
    return null
  }

  return {
    ...metadata,
    title,
    author,
    subject,
    keywords,
    ...(creator ? { creator } : {}),
    ...(producer ? { producer } : {}),
  }
}

export function applyExportMetadata(pdfDocument: PDFDocument, metadata?: ExportMetadata): void {
  const normalized = normalizeExportMetadata(metadata)

  if (normalized) {
    if (normalized.title) pdfDocument.setTitle(normalized.title)
    if (normalized.author) pdfDocument.setAuthor(normalized.author)
    if (normalized.subject) pdfDocument.setSubject(normalized.subject)
    if (normalized.keywords.length) pdfDocument.setKeywords(normalized.keywords)
    if (normalized.creator) pdfDocument.setCreator(normalized.creator)
    pdfDocument.setProducer(normalized.producer ?? 'FluxPDF')
    pdfDocument.setCreationDate(new Date())
    pdfDocument.setModificationDate(new Date())
    return
  }

  pdfDocument.setProducer('FluxPDF')
  pdfDocument.setCreationDate(new Date())
}
