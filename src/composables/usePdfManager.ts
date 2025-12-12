import { ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useDocumentStore } from '@/stores/document'
import { useConverter } from './useConverter'
import { db } from '@/db/db'
import type { StoredFile } from '@/db/db'
import type { SourceFile, PageReference, FileUploadResult } from '@/types'
import type { PDFDocumentProxy } from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * PDF cache: We still keep PARSED documents in RAM for performance,
 * but the raw ArrayBuffers are in IDB.
 */
const pdfDocCache = new Map<string, PDFDocumentProxy>()

export function usePdfManager() {
  const store = useDocumentStore()
  const { convertImageToPdf } = useConverter()
  const isInitialized = ref(false)

  // --- Helper: Color Palette ---
  const PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#06b6d4']
  function getNextColor(index: number): string {
    return PALETTE[index % PALETTE.length] ?? '#3b82f6'
  }

  /**
   * 1. Initialize: Restore Session from IndexedDB
   */
  async function initSession() {
    if (isInitialized.value) return
    store.setLoading(true, 'Restoring session...')

    try {
      // 1. Get the Session FIRST
      const session = await db.session.get('current-session')

      // 2. Determine which files to load
      // If no session exists, load nothing.
      // If session exists but has no activeSourceIds (legacy data), fall back to loading all (migration strategy)
      const activeIds = session?.activeSourceIds

      let filesToLoad: StoredFile[] = []

      if (activeIds) {
        // NEW BEHAVIOR: Load only active files
        filesToLoad = await db.files.where('id').anyOf(activeIds).toArray()
      } else if (!session) {
        // Fresh start
        filesToLoad = []
      } else {
        // Legacy fallback (rare): Load everything if we migrated from old schema
        filesToLoad = await db.files.toArray()
      }

      // 3. Populate Store
      filesToLoad.forEach((f) => {
        store.addSourceFile({
          id: f.id,
          filename: f.filename,
          fileSize: f.fileSize,
          pageCount: f.pageCount,
          addedAt: f.addedAt,
          color: f.color,
        })
      })

      // 4. Restore remaining session state
      if (session) {
        store.projectTitle = session.projectTitle
        store.pages = session.pageMap
        store.setZoom(session.zoom)
      }
    } catch (e) {
      console.error('Session restore failed', e)
    } finally {
      store.setLoading(false)
      isInitialized.value = true
    }
  }

  /**
   * 2. Load File: Save Blob to IDB -> Add Meta to Store
   */
  async function loadPdfFile(file: File): Promise<FileUploadResult> {
    try {
      store.setLoading(true, `Processing ${file.name}...`)
      const arrayBuffer = await file.arrayBuffer()

      // Parse PDF to get page count
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) })
      const pdfDoc = await loadingTask.promise

      const sourceFileId = crypto.randomUUID()
      const color = getNextColor(store.sources.size)

      // A. Save HEAVY data to IndexedDB
      await db.files.add({
        id: sourceFileId,
        data: arrayBuffer, // <--- Stored in DB, NOT RAM
        filename: file.name,
        fileSize: file.size,
        pageCount: pdfDoc.numPages,
        addedAt: Date.now(),
        color,
      })

      // B. Add Lightweight Meta to Store
      const sourceFile: SourceFile = {
        id: sourceFileId,
        filename: file.name,
        pageCount: pdfDoc.numPages,
        fileSize: file.size,
        addedAt: Date.now(),
        color,
      }

      // Cache the parsed doc for immediate use
      pdfDocCache.set(sourceFileId, pdfDoc)

      // C. Generate Pages
      const groupId = crypto.randomUUID()
      const pageRefs: PageReference[] = []
      for (let i = 0; i < pdfDoc.numPages; i++) {
        pageRefs.push({
          id: crypto.randomUUID(),
          sourceFileId,
          sourcePageIndex: i,
          rotation: 0,
          groupId,
        })
      }

      store.setLoading(false)
      return { success: true, sourceFile, pageRefs }
    } catch (error) {
      store.setLoading(false)
      console.error('Failed to load PDF file:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 3. Get Document: RAM Cache -> IDB -> Error
   */
  async function getPdfDocument(sourceFileId: string): Promise<PDFDocumentProxy> {
    // 1. Try RAM Cache
    if (pdfDocCache.has(sourceFileId)) return pdfDocCache.get(sourceFileId)!

    // 2. Try IndexedDB
    const record = await db.files.get(sourceFileId)
    if (!record) throw new Error(`Source file ${sourceFileId} missing from storage`)

    // 3. Hydrate
    const loadingTask = pdfjs.getDocument({ data: record.data.slice(0) })
    const pdfDoc = await loadingTask.promise

    // 4. Update Cache
    pdfDocCache.set(sourceFileId, pdfDoc)
    return pdfDoc
  }

  // Wrapper for multiple files (unchanged logic, just calls loadPdfFile)
  async function loadPdfFiles(files: FileList | File[]) {
    const results = []
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        results.push(await loadPdfFile(file))
      } else if (file.type.startsWith('image/')) {
        const conversion = await convertImageToPdf(file)
        if (conversion.success && conversion.file) {
          results.push(await loadPdfFile(conversion.file))
        }
      }
    }
    return results
  }

  // Retrieve raw buffer for Export
  async function getPdfBlob(sourceFileId: string): Promise<ArrayBuffer | undefined> {
    const record = await db.files.get(sourceFileId)
    return record?.data
  }

  function removeSourceFile(sourceFileId: string) {
    store.removeSourceFile(sourceFileId)
  }

  async function clearAll() {
    await db.files.clear()
    await db.session.clear()
    pdfDocCache.clear()
    store.reset()
  }

  return {
    initSession,
    loadPdfFiles,
    getPdfDocument,
    getPdfBlob,
    removeSourceFile,
    clearAll,
  }
}
