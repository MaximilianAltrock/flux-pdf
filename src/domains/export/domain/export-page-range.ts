import { PAGE_NUMBER_BASE } from '@/shared/constants'
import type { PageEntry, PageReference } from '@/shared/types'
import type { ResolveExportPagesOptions } from '@/domains/export/domain/export-types'

export function parsePageRange(rangeStr: string, maxPages: number): number[] {
  const indices: Set<number> = new Set()

  const parts = rangeStr
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((segment) => segment.trim())
      if (!startStr || !endStr) continue
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let i = Math.max(PAGE_NUMBER_BASE, start); i <= Math.min(maxPages, end); i++) {
          indices.add(i - PAGE_NUMBER_BASE)
        }
      }
      continue
    }

    const pageNum = parseInt(part, 10)
    if (!Number.isNaN(pageNum) && pageNum >= PAGE_NUMBER_BASE && pageNum <= maxPages) {
      indices.add(pageNum - PAGE_NUMBER_BASE)
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

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

export function resolvePagesToExport(options: ResolveExportPagesOptions): PageEntry[] {
  const { pageRange, contentPageCount, contentPages, pages } = options
  if (!pageRange) return pages

  const indices = parsePageRange(pageRange, contentPageCount)
  return indices.map((index) => contentPages[index]).filter((page): page is PageReference => !!page)
}

export function splitPagesIntoSegments(pages: PageEntry[]): PageReference[][] {
  const segments: PageReference[][] = []
  let currentSegment: PageReference[] = []

  for (const page of pages) {
    if (page.isDivider) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment)
        currentSegment = []
      }
      continue
    }

    currentSegment.push(page)
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment)
  }

  return segments
}
