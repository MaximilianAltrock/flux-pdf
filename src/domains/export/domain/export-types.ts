import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { DocumentMetadata, OutlineNode, PageEntry, PageReference } from '@/shared/types'

export type ExportMetadata = DocumentMetadata & {
  creator?: string
  producer?: string
}

export interface ExportResult {
  filename: string
  mimeType: string
  bytes: Uint8Array
  size: number
  originalSize?: number
  compressionRatio?: number
}

export interface ExportOptions {
  filename: string
  pageRange?: string
  metadata?: ExportMetadata
  compress?: boolean
  compressionQuality?:
    | import('@/domains/export/application/usePdfCompression').CompressionQuality
    | 'none'
  outline?: {
    include?: boolean
    flatten?: boolean
    expandAll?: boolean
  }
}

export interface GeneratorOptions {
  metadata?: ExportMetadata
  compress?: boolean
  onProgress?: (percent: number) => void
}

export interface GenerateRawPdfOptions extends GeneratorOptions {
  getPdfBlob: (sourceFileId: string) => Promise<ArrayBuffer | undefined>
  getPdfDocument?: (sourceFileId: string) => Promise<PDFDocumentProxy>
  burnScale?: number
  bookmarks?: OutlineNode[]
  pageIdToDocIndex?: Map<string, number>
  outline?: ExportOptions['outline']
}

export interface ResolveExportPagesOptions {
  pages: PageEntry[]
  contentPages: PageReference[]
  contentPageCount: number
  pageRange?: string
}

export interface ExportBookmarkNode {
  title: string
  dest:
    | { type: 'page'; pageIndex: number; fit?: 'Fit' | 'XYZ'; zoom?: number; y?: number }
    | { type: 'external-url'; url: string }
    | { type: 'none' }
  color?: string
  isBold?: boolean
  isItalic?: boolean
  children?: ExportBookmarkNode[]
  expanded?: boolean
}
