import { ref } from 'vue'
import { PDFDocument, degrees } from 'pdf-lib'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from './usePdfManager'
import type { PageReference, SourceFile } from '@/types'

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
   * Export the current document to a PDF file
   * 
   * @param filename - Output filename (without .pdf extension)
   * @returns Promise that resolves when export is complete
   */
  async function exportPdf(filename = 'document'): Promise<void> {
    if (store.pages.length === 0) {
      throw new Error('No pages to export')
    }

    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      // Create a new PDF document
      const outputPdf = await PDFDocument.create()
      
      // Group pages by source file for efficient batch copying
      const pagesBySource = groupPagesBySource(store.pages)
      
      // Track progress
      let processedPages = 0
      const totalPages = store.pages.length

      // Process each source file
      for (const [sourceFileId, pageRefs] of pagesBySource) {
        // Load the source PDF
        const sourceBuffer = pdfManager.getPdfBlob(sourceFileId)
        if (!sourceBuffer) {
          throw new Error(`Source file not found: ${sourceFileId}`)
        }

        const sourcePdf = await PDFDocument.load(sourceBuffer)

        // Copy pages from this source
        // Get unique page indices we need from this source
        const pageIndices = pageRefs.map(p => p.sourcePageIndex)
        const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndices)

        // Now we need to insert these pages in the correct order
        // Create a map from sourcePageIndex to copied page
        const copiedPageMap = new Map<number, typeof copiedPages[0]>()
        pageIndices.forEach((idx, i) => {
          copiedPageMap.set(idx, copiedPages[i])
        })

        // We'll handle insertion after all copying is done
        // For now, store the mapping
        for (const pageRef of pageRefs) {
          const copiedPage = copiedPageMap.get(pageRef.sourcePageIndex)
          if (copiedPage) {
            // Apply rotation if needed
            if (pageRef.rotation !== 0) {
              const currentRotation = copiedPage.getRotation().angle
              copiedPage.setRotation(degrees(currentRotation + pageRef.rotation))
            }
          }
          
          processedPages++
          exportProgress.value = Math.round((processedPages / totalPages) * 100)
        }
      }

      // Now add all pages in the correct order
      // We need to re-copy to maintain order since copyPages doesn't preserve our virtual order
      const finalPdf = await PDFDocument.create()
      
      // Process pages in their virtual order
      processedPages = 0
      for (const pageRef of store.pages) {
        const sourceBuffer = pdfManager.getPdfBlob(pageRef.sourceFileId)
        if (!sourceBuffer) continue

        const sourcePdf = await PDFDocument.load(sourceBuffer)
        const [copiedPage] = await finalPdf.copyPages(sourcePdf, [pageRef.sourcePageIndex])
        
        // Apply rotation
        if (pageRef.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle
          copiedPage.setRotation(degrees(currentRotation + pageRef.rotation))
        }
        
        finalPdf.addPage(copiedPage)
        
        processedPages++
        exportProgress.value = Math.round((processedPages / totalPages) * 100)
      }

      // Generate the final PDF bytes
      const pdfBytes = await finalPdf.save()

      // Trigger download
      downloadPdf(pdfBytes, `${filename}.pdf`)

      exportProgress.value = 100
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
   * Export only selected pages
   */
  async function exportSelectedPages(filename = 'selected-pages'): Promise<void> {
    if (store.selectedCount === 0) {
      throw new Error('No pages selected')
    }

    const selectedPages = store.pages.filter(p => 
      store.selection.selectedIds.has(p.id)
    )

    // Temporarily replace pages array for export
    const originalPages = store.pages
    store.pages = selectedPages

    try {
      await exportPdf(filename)
    } finally {
      store.pages = originalPages
    }
  }

  /**
   * Group pages by their source file for efficient batch processing
   */
  function groupPagesBySource(pages: PageReference[]): Map<string, PageReference[]> {
    const groups = new Map<string, PageReference[]>()
    
    for (const page of pages) {
      const existing = groups.get(page.sourceFileId)
      if (existing) {
        existing.push(page)
      } else {
        groups.set(page.sourceFileId, [page])
      }
    }
    
    return groups
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

  return {
    isExporting,
    exportProgress,
    exportError,
    exportPdf,
    exportSelectedPages,
    getSuggestedFilename
  }
}
