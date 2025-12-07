import { ref } from 'vue'
import type { SourceFile, PageReference, FileUploadResult } from '@/types'
import { useDocumentStore } from '@/stores/document'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'

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

const PALETTE = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#eab308', // yellow-500
  '#6366f1', // indigo-500
  '#ef4444', // red-500
  '#14b8a6', // teal-500
  '#84cc16', // lime-500
  '#d946ef'  // fuchsia-500
]

/**
 * Composable for managing PDF files
 */
export function usePdfManager() {
  const store = useDocumentStore()
  const isInitialized = ref(true) // Already initialized via static import

  function getNextColor(): string {
    const usedCount = store.sourceFileList.length
    return PALETTE[usedCount % PALETTE.length] ?? 'blue'
  }

  /**
   * Initialize PDF.js library
   * Now a no-op since we use static imports, but kept for API compatibility
   */
  async function initPdfJs(): Promise<void> {
    // Worker is already configured via static import
    return
  }

  /**
   * Update project title on first import
   */
  function trySetProjectTitle(filename: string) {
    if (!store.isTitleLocked) {
      // Remove extension
      const name = filename.replace(/\.[^/.]+$/, "")
      store.projectTitle = name
      store.isTitleLocked = true
    }
  }

  /**
   * Load a PDF file and add it to the document
   */
  async function loadPdfFile(file: File, autoAddPages = true): Promise<FileUploadResult> {
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
        color: getNextColor()
      }

      // Store the COPY of the blob (not the potentially detached original)
      pdfBlobStore.set(sourceFileId, bufferCopy)

      // Cache the parsed document
      pdfDocCache.set(sourceFileId, pdfDoc)

      // Add to store
      store.addSourceFile(sourceFile)

      // Try to set title
      trySetProjectTitle(file.name)

      if (autoAddPages) {
          // Create page references for all pages
          const groupId = generateId() // Generate a unique group ID for this import batch (initially same as source usually, but distinct concept)

          const pageRefs: PageReference[] = []
          for (let i = 0; i < pdfDoc.numPages; i++) {
            pageRefs.push({
              id: generateId(),
              sourceFileId,
              sourcePageIndex: i,
              rotation: 0,
              groupId // All pages from this import get same group ID initially
            })
          }

          // Add pages to the document
          store.addPages(pageRefs)
      }

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
   /**
   * Convert Image to PDF and load it
   */
  async function loadImageFile(file: File, autoAddPages = true): Promise<FileUploadResult> {
     try {
      store.setLoading(true, `Converting ${file.name}...`)

      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.create()

      let image
      if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
        image = await pdfDoc.embedJpg(arrayBuffer)
      } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        image = await pdfDoc.embedPng(arrayBuffer)
      } else {
        throw new Error('Unsupported image format')
      }

      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      })

      const pdfBytes = await pdfDoc.save()

      // Convert back to File to reuse loadPdfFile logic (simpler than duplicating it)
      const pdfFile = new File([pdfBytes as any], `${file.name}.pdf`, { type: 'application/pdf' })

      // Load the generated PDF
      const result = await loadPdfFile(pdfFile, autoAddPages)

      // Override filename in result/source to show original image name if needed?
      // User requirement: "If file is Image: Accept (convert to single page PDF internally)."
      // Ideally we keep the original name. loadPdfFile uses file.name.
      // We essentially just "converted" it. The Title Logic uses file.name.
      // If we pass `${file.name}.pdf`, the title logic will strip .pdf and get `image.jpg`. Perfect.

      return result

     } catch (error) {
       store.setLoading(false)
       const message = error instanceof Error ? error.message : 'Failed to convert image'
       console.error('Image load error:', error)
       return {
         success: false,
         error: message
       }
     }
  }

  /**
   * Load multiple files (PDFs or Images)
   */
  async function loadPdfFiles(files: FileList | File[], autoAddPages = true): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = []

    for (const file of Array.from(files)) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name)

      if (isPdf) {
        const result = await loadPdfFile(file, autoAddPages)
        results.push(result)
      } else if (isImage) {
        const result = await loadImageFile(file, autoAddPages)
        results.push(result)
      } else {
        results.push({
          success: false,
          error: `${file.name} is not a supported file type`,
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
