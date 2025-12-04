import { ref } from 'vue'
import { PDFDocument, degrees } from 'pdf-lib'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from './usePdfManager'
import type { PageReference } from '@/types'

/**
 * PDF metadata options
 */
export interface PdfMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
  creator?: string
  producer?: string
}

/**
 * Export options
 */
export interface ExportOptions {
  filename: string
  pageRange?: string // e.g., "1-5, 8, 10-12"
  metadata?: PdfMetadata
  compress?: boolean
}

/**
 * Parse a page range string into an array of 0-based indices
 * e.g., "1-5, 8, 10-12" => [0, 1, 2, 3, 4, 7, 9, 10, 11]
 */
export function parsePageRange(rangeStr: string, maxPages: number): number[] {
  const indices: Set<number> = new Set()

  // Split by comma
  const parts = rangeStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      // Range: "1-5"
      const [startStr, endStr] = part.split('-').map((s) => s.trim())
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
          indices.add(i - 1) // Convert to 0-based
        }
      }
    } else {
      // Single page: "8"
      const pageNum = parseInt(part, 10)
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
        indices.add(pageNum - 1) // Convert to 0-based
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Validate a page range string
 */
export function validatePageRange(
  rangeStr: string,
  maxPages: number,
): { valid: boolean; error?: string } {
  if (!rangeStr.trim()) {
    return { valid: false, error: 'Page range is required' }
  }

  const indices = parsePageRange(rangeStr, maxPages)

  if (indices.length === 0) {
    return { valid: false, error: 'No valid pages in range' }
  }

  return { valid: true }
}

/**
 * Composable for exporting the virtual document to a real PDF
 */
export function usePdfExport() {
  const store = useDocumentStore()
  const pdfManager = usePdfManager()

  const isExporting = ref(false)
  const exportProgress = ref(0)
  const exportError = ref<string | null>(null)

  /**
   * Export with full options
   */
  async function exportWithOptions(options: ExportOptions): Promise<void> {
    const { filename, pageRange, metadata, compress } = options

    // Determine which pages to export
    let pagesToExport: PageReference[]

    if (pageRange) {
      const indices = parsePageRange(pageRange, store.pages.length)
      pagesToExport = indices.map((i) => store.pages[i]).filter(Boolean)
    } else {
      pagesToExport = store.pages
    }

    if (pagesToExport.length === 0) {
      throw new Error('No pages to export')
    }

    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      // Create a new PDF document
      const finalPdf = await PDFDocument.create()

      // Set metadata if provided
      if (metadata) {
        if (metadata.title) finalPdf.setTitle(metadata.title)
        if (metadata.author) finalPdf.setAuthor(metadata.author)
        if (metadata.subject) finalPdf.setSubject(metadata.subject)
        if (metadata.keywords) finalPdf.setKeywords(metadata.keywords)
        if (metadata.creator) finalPdf.setCreator(metadata.creator)
        finalPdf.setProducer(metadata.producer ?? 'FluxPDF')
        finalPdf.setCreationDate(new Date())
        finalPdf.setModificationDate(new Date())
      } else {
        finalPdf.setProducer('FluxPDF')
        finalPdf.setCreationDate(new Date())
      }

      // Cache loaded PDFs to avoid reloading
      const loadedPdfs = new Map<string, any>()

      // Track progress
      let processedPages = 0
      const totalPages = pagesToExport.length

      // Process pages in their virtual order
      for (const pageRef of pagesToExport) {
        // Get or load the source PDF
        let sourcePdf = loadedPdfs.get(pageRef.sourceFileId)

        if (!sourcePdf) {
          const sourceBuffer = await pdfManager.getPdfData(pageRef.sourceFileId)
          if (!sourceBuffer) {
            throw new Error(`Source file not found: ${pageRef.sourceFileId}`)
          }
          sourcePdf = await PDFDocument.load(sourceBuffer)
          loadedPdfs.set(pageRef.sourceFileId, sourcePdf)
        }

        const [copiedPage] = await finalPdf.copyPages(sourcePdf, [pageRef.sourcePageIndex])

        // Apply rotation
        if (pageRef.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle
          copiedPage.setRotation(degrees(currentRotation + pageRef.rotation))
        }

        finalPdf.addPage(copiedPage)

        processedPages++
        exportProgress.value = Math.round((processedPages / totalPages) * 90) // Reserve 10% for saving

        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      // Generate the final PDF bytes
      // Note: pdf-lib doesn't have built-in compression, but we can use objectsPerTick
      // to balance memory usage. For actual compression, we'd need a different library.
      const pdfBytes = await finalPdf.save({
        useObjectStreams: compress ?? true,
        addDefaultPage: false,
      })

      exportProgress.value = 100

      // Trigger download
      downloadPdf(pdfBytes, `${filename}.pdf`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      exportError.value = message
      console.error('PDF export error:', error)
      throw error
    } finally {
      isExporting.value = false
    }
  }

  /**
   * Simple export (backward compatible)
   */
  async function exportPdf(filename = 'document'): Promise<void> {
    return exportWithOptions({ filename })
  }

  /**
   * Export only selected pages
   */
  async function exportSelectedPages(filename = 'selected-pages'): Promise<void> {
    if (store.selectedCount === 0) {
      throw new Error('No pages selected')
    }

    const selectedIndices = store.pages
      .map((p, i) => (store.selection.selectedIds.has(p.id) ? i + 1 : null))
      .filter((i): i is number => i !== null)

    const pageRange = selectedIndices.join(', ')

    return exportWithOptions({ filename, pageRange })
  }

  /**
   * Trigger a browser download for the PDF
   */
  function downloadPdf(data: Uint8Array, filename: string): void {
    const blob = new Blob([data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up the blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /**
   * Get a suggested filename based on source files
   */
  function getSuggestedFilename(): string {
    const sources = store.sourceFileList

    if (sources.length === 0) {
      return 'document'
    }

    if (sources.length === 1) {
      // Use the original filename without extension
      const name = sources[0].filename.replace(/\.pdf$/i, '')
      return `${name}-edited`
    }

    // Multiple sources - use generic name
    return 'merged-document'
  }

  /**
   * Get estimated file size (rough approximation)
   */
  function getEstimatedSize(): string {
    let totalSize = 0
    for (const source of store.sourceFileList) {
      totalSize += source.fileSize
    }

    // Very rough estimate - actual size depends on many factors
    const avgPageSize = totalSize / Math.max(1, store.pages.length)
    const estimatedSize = avgPageSize * store.pages.length

    if (estimatedSize < 1024) return `${estimatedSize} B`
    if (estimatedSize < 1024 * 1024) return `~${(estimatedSize / 1024).toFixed(1)} KB`
    return `~${(estimatedSize / (1024 * 1024)).toFixed(1)} MB`
  }

  return {
    isExporting,
    exportProgress,
    exportError,
    exportPdf,
    exportWithOptions,
    exportSelectedPages,
    getSuggestedFilename,
    getEstimatedSize,
    parsePageRange,
    validatePageRange,
  }
}
