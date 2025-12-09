import { ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
// Import worker URL using Vite's ?url suffix
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import { useDocumentStore } from '@/stores/document'
import { useConverter } from './useConverter'
import type { SourceFile, PageReference, FileUploadResult } from '@/types'

// Configure worker immediately
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * In-memory storage for PDF blobs.
 * Keyed by sourceFileId.
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
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#eab308',
  '#6366f1',
  '#ef4444',
  '#14b8a6',
  '#84cc16',
  '#d946ef',
]

export function usePdfManager() {
  const store = useDocumentStore()
  const { convertImageToPdf } = useConverter()

  const isInitialized = ref(true)

  function getNextColor(): string {
    const usedCount = store.sourceFileList.length
    return PALETTE[usedCount % PALETTE.length] ?? 'blue'
  }

  function trySetProjectTitle(filename: string) {
    if (!store.isTitleLocked) {
      const name = filename.replace(/\.[^/.]+$/, '')
      store.projectTitle = name
      store.isTitleLocked = true
    }
  }

  /**
   * Load a single PDF file (Internal)
   */
  async function loadPdfFile(file: File): Promise<FileUploadResult> {
    try {
      store.setLoading(true, `Loading ${file.name}...`)

      const arrayBuffer = await file.arrayBuffer()
      // Copy buffer to prevent detachment issues
      const bufferCopy = arrayBuffer.slice(0)

      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise

      const sourceFileId = generateId()
      const sourceFile: SourceFile = {
        id: sourceFileId,
        filename: file.name,
        pageCount: pdfDoc.numPages,
        fileSize: file.size,
        addedAt: Date.now(),
        color: getNextColor(),
      }

      pdfBlobStore.set(sourceFileId, bufferCopy)
      pdfDocCache.set(sourceFileId, pdfDoc)

      trySetProjectTitle(file.name)

      const groupId = generateId()
      const pageRefs: PageReference[] = []

      for (let i = 0; i < pdfDoc.numPages; i++) {
        pageRefs.push({
          id: generateId(),
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
      const message = error instanceof Error ? error.message : 'Failed to load PDF'
      console.error('PDF load error:', error)
      return { success: false, error: message }
    }
  }

  /**
   * Main Entry Point: Load multiple files (PDFs or Images)
   */
  async function loadPdfFiles(files: FileList | File[]): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = []

    for (const file of Array.from(files)) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name)

      if (isPdf) {
        // Direct load
        const result = await loadPdfFile(file)
        results.push(result)
      } else if (isImage) {
        // Convert then load
        store.setLoading(true, `Converting ${file.name}...`)
        const conversion = await convertImageToPdf(file)

        if (conversion.success && conversion.file) {
          const result = await loadPdfFile(conversion.file)
          results.push(result)
        } else {
          store.setLoading(false)
          results.push({
            success: false,
            error: conversion.error || `Failed to convert ${file.name}`,
          })
        }
      } else {
        results.push({
          success: false,
          error: `${file.name} is not a supported file type`,
        })
      }
    }

    return results
  }

  async function getPdfDocument(sourceFileId: string): Promise<any> {
    if (pdfDocCache.has(sourceFileId)) return pdfDocCache.get(sourceFileId)

    const arrayBuffer = pdfBlobStore.get(sourceFileId)
    if (!arrayBuffer) throw new Error(`Source file ${sourceFileId} not found`)

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) })
    const pdfDoc = await loadingTask.promise

    pdfDocCache.set(sourceFileId, pdfDoc)
    return pdfDoc
  }

  function getPdfBlob(sourceFileId: string): ArrayBuffer | undefined {
    const buffer = pdfBlobStore.get(sourceFileId)
    return buffer ? buffer.slice(0) : undefined
  }

  function removeSourceFile(sourceFileId: string): void {
    const doc = pdfDocCache.get(sourceFileId)
    if (doc) {
      doc.cleanup()
      doc.destroy()
    }
    pdfBlobStore.delete(sourceFileId)
    pdfDocCache.delete(sourceFileId)
    store.removeSourceFile(sourceFileId)
  }

  function clearAll(): void {
    pdfBlobStore.clear()
    pdfDocCache.clear()
    store.reset()
  }

  return {
    isInitialized,
    loadPdfFiles,
    getPdfDocument,
    getPdfBlob,
    removeSourceFile,
    clearAll,
  }
}
