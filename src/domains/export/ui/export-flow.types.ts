import type { CompressionQuality } from '@/domains/export/application/usePdfCompression'

export interface ExportSettings {
  filename: string
  pageRangeMode: 'all' | 'selected' | 'custom'
  customPageRange: string
  compress: boolean
  compressionQuality: CompressionQuality | 'none'
  outlineInclude: boolean
  outlineFlatten: boolean
  outlineExpandAll: boolean
}

export interface ExportStats {
  filename: string
  sizeKB: number
  durationMs: number
  originalSizeKB?: number
  compressionRatio?: number
}
