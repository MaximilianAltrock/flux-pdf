import { ref } from 'vue'
import { PDFDocument, degrees } from 'pdf-lib'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from './usePdfManager'
import { usePdfCompression, type CompressionQuality } from './usePdfCompression'
import JSZip from 'jszip'
import type { PageReference } from '@/types'
import { mapBookmarksToExport, addBookmarks } from '@/utils/pdf-outline-export'
import { parsePageRange } from '@/utils/page-range'

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

export interface ExportResult {
  filename: string
  size: number
  originalSize?: number
  compressionRatio?: number
}

/**
 * Export options
 */
export interface ExportOptions {
  filename: string
  pageRange?: string // e.g., "1-5, 8, 10-12"
  metadata?: PdfMetadata
  compress?: boolean // Object stream compression (pdf-lib)
  compressionQuality?: CompressionQuality | 'none' // Ghostscript WASM compression
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

    // Group pages by source file to perform batch operations
    const pagesBySource = new Map<string, { pageRef: PageReference; finalIndex: number }[]>()

    // 1. Group pages by source
    pages.forEach((page, index) => {
      if (!pagesBySource.has(page.sourceFileId)) {
        pagesBySource.set(page.sourceFileId, [])
      }
      pagesBySource.get(page.sourceFileId)!.push({ pageRef: page, finalIndex: index })
    })

    // Array to hold the resulting PDFPage objects in their correct visual order
    const importedPages: any[] = Array.from({ length: pages.length })

    // 2. Process each source file batch
    let processedPages = 0
    const totalPages = pages.length

    for (const [sourceId, items] of pagesBySource) {
      // Get or load the source PDF
      let sourcePdf = loadedPdfs.get(sourceId)

      if (!sourcePdf) {
        const sourceBuffer = await pdfManager.getPdfBlob(sourceId)
        if (!sourceBuffer) {
          throw new Error(`Source file not found: ${sourceId}`)
        }
        sourcePdf = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
        loadedPdfs.set(sourceId, sourcePdf)
      }

      // Extract indices to copy for this batch
      const sourceIndices = items.map((item) => item.pageRef.sourcePageIndex)

      // Batch copy - this is where the deduplication magic happens
      const copiedPages = await finalPdf.copyPages(sourcePdf, sourceIndices)

      if (copiedPages.length !== items.length) {
        throw new Error('Failed to copy some pages')
      }

      // 3. Process copied pages (rotation) and place in final array
      for (let i = 0; i < copiedPages.length; i++) {
        const pdfPage = copiedPages[i]
        const item = items[i]

        if (!item || !pdfPage) continue

        const { pageRef, finalIndex } = item

        // Apply rotation
        if (pageRef.rotation !== 0) {
          const currentRotation = pdfPage.getRotation().angle
          pdfPage.setRotation(degrees(currentRotation + pageRef.rotation))
        }

        importedPages[finalIndex] = pdfPage
        processedPages++

        if (onProgress) {
          onProgress(Math.round((processedPages / totalPages) * 90))
        }
      }

      // Allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    // 4. Add pages to final document in correct order
    for (const page of importedPages) {
      if (page) {
        finalPdf.addPage(page)
      }
    }

    // Build mapping AFTER pages are finalized
    const pageIdToIndex = new Map<string, number>()
    let idx = 0
    for (const p of pages) {
      if (p.isDivider) continue
      pageIdToIndex.set(p.id, idx++)
    }

    const exportBookmarks = mapBookmarksToExport(store.bookmarksTree as any, pageIdToIndex)
    await addBookmarks(finalPdf, exportBookmarks)

    // Generate the final PDF bytes
    return await finalPdf.save({
      useObjectStreams: compress ?? true,
      addDefaultPage: false,
    })
  }

  /**
   * Export with full options (Handles ZIP splitting and Downloads)
   */
  async function exportWithOptions(options: ExportOptions): Promise<ExportResult> {
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

        return {
          filename: `${filename}.zip`,
          size: zipContent.byteLength,
        }
      } else {
        // SINGLE PDF EXPORT (Segment 0)
        const segmentPages = segments[0]
        if (segmentPages) {
          let pdfBytes = await generateRawPdf(segmentPages, {
            metadata,
            compress,
            onProgress: (val) => {
              // Scale to 70% for PDF generation, leave 30% for compression
              const scaledProgress =
                options.compressionQuality && options.compressionQuality !== 'none'
                  ? Math.round(val * 0.7)
                  : val
              exportProgress.value = scaledProgress
            },
          })

          let originalSize = pdfBytes.byteLength
          let compressionRatio = 0

          // CHECK: Are we exporting all pages from the source files?
          // If so, we should report the "Original Size" as the sum of the source files (consistent with SourceRail)
          // rather than the pdf-lib generated buffer size (which might be optimized/repacked).
          const pagesBySource = new Map<string, number>()
          for (const p of segmentPages) {
            if (p.isDivider) continue
            const count = pagesBySource.get(p.sourceFileId) || 0
            pagesBySource.set(p.sourceFileId, count + 1)
          }

          let isFullSourceExport = true
          for (const [sId, count] of pagesBySource) {
            const source = store.sources.get(sId)
            // If we are missing pages from this source, it's a partial export
            if (source && count !== source.pageCount) {
              isFullSourceExport = false
              break
            }
          }

          // If it's a full export (and we have pages), use the estimated size (which is exact for full exports)
          if (isFullSourceExport && segmentPages.length > 0) {
            originalSize = getEstimatedSize(segmentPages)
          }

          // Apply Ghostscript compression if quality is specified
          if (options.compressionQuality && options.compressionQuality !== 'none') {
            exportProgress.value = 75
            const { compressPdf } = usePdfCompression()
            const result = await compressPdf(pdfBytes, { quality: options.compressionQuality })
            pdfBytes = result.data

            // Only update originalSize if we didn't already set a semantic "Source Original"
            // Or if the compression somehow started from a larger base (unlikely but safe)
            if (!isFullSourceExport) {
              originalSize = result.originalSize
            }

            // Recalculate ratio based on our Truth Original Size
            if (originalSize > 0) {
              compressionRatio = 1 - pdfBytes.byteLength / originalSize
            }
            exportProgress.value = 95
          }

          exportProgress.value = 100
          // Trigger download
          downloadFile(pdfBytes, `${filename}.pdf`, 'application/pdf')

          return {
            filename: `${filename}.pdf`,
            size: pdfBytes.byteLength,
            originalSize: originalSize !== pdfBytes.byteLength ? originalSize : undefined,
            compressionRatio: compressionRatio > 0 ? compressionRatio : undefined,
          }
        }
        throw new Error('No pages generated')
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
  async function exportPdf(filename = 'document'): Promise<ExportResult> {
    return exportWithOptions({ filename })
  }

  /**
   * Export only selected pages wrapper
   */
  async function exportSelectedPages(filename = 'selected-pages'): Promise<ExportResult> {
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
    const arrayBuffer =
      data.buffer instanceof ArrayBuffer
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data.slice().buffer

    const blob = new Blob([arrayBuffer], { type: mimeType })
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
  function getEstimatedSize(pagesToEstimate?: PageReference[]): number {
    const pagesList = pagesToEstimate || store.pages
    let totalEstimatedSize = 0

    // Group pages by source file to check for full file inclusion
    const pagesBySource = new Map<string, number>()

    for (const page of pagesList) {
      if (page.isDivider) continue
      const currentCount = pagesBySource.get(page.sourceFileId) || 0
      pagesBySource.set(page.sourceFileId, currentCount + 1)
    }

    for (const [sourceId, count] of pagesBySource) {
      const source = store.sources.get(sourceId)
      if (!source) continue

      // If exporting exactly the number of pages the source has, assume full file size
      // This ensures 1:1 match with SourceRail display for "whole file" exports
      if (count === source.pageCount) {
        totalEstimatedSize += source.fileSize
      } else {
        // Otherwise use proportional estimation
        const avgPageSize = source.fileSize / Math.max(1, source.pageCount)
        totalEstimatedSize += count * avgPageSize
      }
    }

    return totalEstimatedSize
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
  }
}
