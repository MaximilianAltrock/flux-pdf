import { ref } from 'vue'
import type { SourceFile, PageReference, FileUploadResult } from '@/types'
import { useDocumentStore } from '@/stores/document'
import * as pdfjs from 'pdfjs-dist'

// Import worker URL using Vite's ?url suffix
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure worker immediately
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * In-memory storage for PDF blobs.
 * Keyed by sourceFileId.
 *
 */
const pdfBlobStore = new Map<string, ArrayBuffer>()

/**
 * PDF.js document cache to avoid re-parsing
 */
const pdfDocCache = new Map<string, any>()

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Composable for managing PDF files
 */
export function usePdfManager() {
  const store = useDocumentStore()
  const isInitialized = ref(true) // Already initialized via static import

  /**
   * Initialize PDF.js library
   * Now a no-op since we use static imports, but kept for API compatibility
   */
  async function initPdfJs(): Promise<void> {
    // Worker is already configured via static import
    return
  }

  /**
   * Load a PDF file and add it to the document
   */
  async function loadPdfFile(file: File): Promise<FileUploadResult> {
    try {
      store.setLoading(true, `Loading ${file.name}...`)

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()

      // IMPORTANT: Store a copy of the buffer BEFORE passing to PDF.js
      // PDF.js transfers the buffer to a worker, which detaches the original
      const bufferCopy = arrayBuffer.slice(0)

      // Parse with PDF.js (this may detach the original arrayBuffer)
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise

      // Generate source file entry
      const sourceFileId = generateId()
      const sourceFile: SourceFile = {
        id: sourceFileId,
        filename: file.name,
        pageCount: pdfDoc.numPages,
        fileSize: file.size,
        addedAt: Date.now(),
      }

      // Store the COPY of the blob (not the potentially detached original)
      pdfBlobStore.set(sourceFileId, bufferCopy)

      // Cache the parsed document
      pdfDocCache.set(sourceFileId, pdfDoc)

      // Add to store
      store.addSourceFile(sourceFile)

      // Create page references for all pages
      const pageRefs: PageReference[] = []
      for (let i = 0; i < pdfDoc.numPages; i++) {
        pageRefs.push({
          id: generateId(),
          sourceFileId,
          sourcePageIndex: i,
          rotation: 0,
        })
      }

      // Add pages to the document
      store.addPages(pageRefs)

      store.setLoading(false)

      return {
        success: true,
        sourceFile,
      }
    } catch (error) {
      store.setLoading(false)
      const message = error instanceof Error ? error.message : 'Failed to load PDF'
      console.error('PDF load error:', error)
      return {
        success: false,
        error: message,
      }
    }
  }

  /**
   * Load multiple PDF files
   */
  async function loadPdfFiles(files: FileList | File[]): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = []

    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const result = await loadPdfFile(file)
        results.push(result)
      } else {
        results.push({
          success: false,
          error: `${file.name} is not a PDF file`,
        })
      }
    }

    return results
  }

  /**
   * Get the parsed PDF document for a source file
   */
  async function getPdfDocument(sourceFileId: string): Promise<any> {
    // Check cache first
    if (pdfDocCache.has(sourceFileId)) {
      return pdfDocCache.get(sourceFileId)
    }

    // Otherwise, load from blob store
    const arrayBuffer = pdfBlobStore.get(sourceFileId)
    if (!arrayBuffer) {
      throw new Error(`Source file ${sourceFileId} not found`)
    }

    // Use a copy to prevent detachment issues
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) })
    const pdfDoc = await loadingTask.promise

    pdfDocCache.set(sourceFileId, pdfDoc)
    return pdfDoc
  }

  /**
   * Get a COPY of the ArrayBuffer for a source file (for export)
   * Returns a copy to prevent detachment issues with pdf-lib
   */
  function getPdfBlob(sourceFileId: string): ArrayBuffer | undefined {
    const buffer = pdfBlobStore.get(sourceFileId)
    return buffer ? buffer.slice(0) : undefined
  }

  /**
   * Remove a source file and clean up
   */
  function removeSourceFile(sourceFileId: string): void {
    const doc = pdfDocCache.get(sourceFileId)
    if (doc) {
      doc.cleanup() // Cleans up rendering resources
      doc.destroy() // Kills the worker thread for this doc
    }

    pdfBlobStore.delete(sourceFileId)
    pdfDocCache.delete(sourceFileId)
    store.removeSourceFile(sourceFileId)
  }

  /**
   * Clear all data
   */
  function clearAll(): void {
    pdfBlobStore.clear()
    pdfDocCache.clear()
    store.reset()
  }

  return {
    isInitialized,
    initPdfJs,
    loadPdfFile,
    loadPdfFiles,
    getPdfDocument,
    getPdfBlob,
    removeSourceFile,
    clearAll,
  }
}
