import { ref } from 'vue'
import { PDFDocument, degrees } from 'pdf-lib'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from './usePdfManager'
import JSZip from 'jszip'
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
 * Options for the raw generator
 */
export interface GeneratorOptions {
  metadata?: PdfMetadata
  compress?: boolean
  onProgress?: (percent: number) => void
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
      if (!startStr || !endStr) continue
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
   * Core Generator Function (Exposed)
   * Generates a Uint8Array PDF from a list of PageReferences
   */
  async function generateRawPdf(
    pages: PageReference[],
    options: GeneratorOptions = {},
  ): Promise<Uint8Array> {
    const { metadata, compress, onProgress } = options

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
    const loadedPdfs = new Map<string, PDFDocument>()

    // Track progress
    let processedPages = 0
    const totalPages = pages.length

    // Process pages in their virtual order
    for (const pageRef of pages) {
      // Get or load the source PDF
      let sourcePdf = loadedPdfs.get(pageRef.sourceFileId)

      if (!sourcePdf) {
        const sourceBuffer = await pdfManager.getPdfBlob(pageRef.sourceFileId)
        if (!sourceBuffer) {
          throw new Error(`Source file not found: ${pageRef.sourceFileId}`)
        }
        sourcePdf = await PDFDocument.load(sourceBuffer)
        loadedPdfs.set(pageRef.sourceFileId, sourcePdf)
      }

      const [copiedPage] = await finalPdf.copyPages(sourcePdf, [pageRef.sourcePageIndex])

      if (!copiedPage) {
        throw new Error('Failed to copy page')
      }

      // Apply rotation
      if (pageRef.rotation !== 0) {
        const currentRotation = copiedPage.getRotation().angle
        copiedPage.setRotation(degrees(currentRotation + pageRef.rotation))
      }

      finalPdf.addPage(copiedPage)

      processedPages++

      if (onProgress) {
        onProgress(Math.round((processedPages / totalPages) * 90))
      }

      // Allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    // Generate the final PDF bytes
    return await finalPdf.save({
      useObjectStreams: compress ?? true,
      addDefaultPage: false,
    })
  }

  /**
   * Export with full options (Handles ZIP splitting and Downloads)
   */
  async function exportWithOptions(options: ExportOptions): Promise<void> {
    const { filename, pageRange, metadata, compress } = options

    // Determine which pages to export
    let pagesToExport: PageReference[]

    if (pageRange) {
      const indices = parsePageRange(pageRange, store.pages.length)
      pagesToExport = indices
        .map((i) => store.pages[i])
        // Keep dividers to know where to split
        .filter((p): p is PageReference => !!p)
    } else {
      pagesToExport = store.pages
    }

    // Group pages into segments based on Dividers
    const segments: PageReference[][] = []
    let currentSegment: PageReference[] = []

    for (const page of pagesToExport) {
      if (page.isDivider) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment)
          currentSegment = []
        }
      } else {
        currentSegment.push(page)
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment)
    }

    if (segments.length === 0) {
      throw new Error('No pages to export')
    }

    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      if (segments.length > 1) {
        // ZIP EXPORT
        const zip = new JSZip()

        for (let i = 0; i < segments.length; i++) {
          const segmentPages = segments[i]
          if (!segmentPages || segmentPages.length === 0) continue

          // Generate PDF for this segment using the raw generator
          const pdfBytes = await generateRawPdf(segmentPages, {
            metadata,
            compress,
            // We don't track detailed progress for individual zip parts to keep UI simple
            onProgress: undefined,
          })

          zip.file(`${filename}-part${i + 1}.pdf`, pdfBytes)

          // Simple progress update based on segments done
          exportProgress.value = Math.round(((i + 1) / segments.length) * 80)
        }

        exportProgress.value = 90
        const zipContent = await zip.generateAsync({ type: 'uint8array' })
        exportProgress.value = 100

        downloadFile(zipContent, `${filename}.zip`, 'application/zip')
      } else {
        // SINGLE PDF EXPORT (Segment 0)
        const segmentPages = segments[0]
        if (segmentPages) {
          const pdfBytes = await generateRawPdf(segmentPages, {
            metadata,
            compress,
            onProgress: (val) => {
              exportProgress.value = val
            },
          })

          // Trigger download
          downloadFile(pdfBytes, `${filename}.pdf`, 'application/pdf')
        }
      }
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
   * Simple export wrapper
   */
  async function exportPdf(filename = 'document'): Promise<void> {
    return exportWithOptions({ filename })
  }

  /**
   * Export only selected pages wrapper
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
   * Trigger a browser download
   */
  function downloadFile(data: Uint8Array, filename: string, mimeType = 'application/pdf'): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([data as any], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

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

    if (sources.length === 1 && sources[0]) {
      const name = sources[0].filename.replace(/\.pdf$/i, '')
      return `${name}-edited`
    }

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
    generateRawPdf,
    exportPdf,
    exportWithOptions,
    exportSelectedPages,
    getSuggestedFilename,
    getEstimatedSize,
    parsePageRange,
    validatePageRange,
  }
}
