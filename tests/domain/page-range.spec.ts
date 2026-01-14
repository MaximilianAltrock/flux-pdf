import { describe, expect, it } from 'vitest'
import {
  parsePageRange,
  resolvePagesToExport,
  splitPagesIntoSegments,
  validatePageRange,
} from '@/domain/document/export'
import { ROTATION_DEFAULT_DEGREES } from '@/constants'
import type { PageEntry, PageReference } from '@/types'

const makePage = (id: string, sourceFileId = 's1', sourcePageIndex = 0): PageReference => ({
  id,
  sourceFileId,
  sourcePageIndex,
  rotation: ROTATION_DEFAULT_DEGREES,
  groupId: 'g1',
  isDivider: false,
})

const divider: PageEntry = { id: 'divider-1', isDivider: true }

describe('parsePageRange', () => {
  it('parses ranges and de-duplicates indices', () => {
    expect(parsePageRange('1-3, 5, 5, 8-9', 10)).toEqual([0, 1, 2, 4, 7, 8])
  })

  it('clamps to max pages and ignores invalid tokens', () => {
    expect(parsePageRange('0, -2, 2-4, 99', 3)).toEqual([1, 2])
  })
})

describe('validatePageRange', () => {
  it('rejects empty ranges', () => {
    expect(validatePageRange('', 5).valid).toBe(false)
  })

  it('rejects ranges with no valid pages', () => {
    expect(validatePageRange('99', 5).valid).toBe(false)
  })

  it('accepts valid ranges', () => {
    expect(validatePageRange('1-2', 5).valid).toBe(true)
  })
})

describe('resolvePagesToExport', () => {
  it('returns full page map when no range is provided', () => {
    const pages: PageEntry[] = [makePage('p1', 's1', 0), divider, makePage('p2', 's1', 1)]
    const contentPages = pages.filter((p): p is PageReference => !p.isDivider)
    const resolved = resolvePagesToExport({
      pages,
      contentPages,
      contentPageCount: contentPages.length,
    })
    expect(resolved).toEqual(pages)
  })

  it('returns content pages for a range', () => {
    const pages: PageEntry[] = [makePage('p1', 's1', 0), divider, makePage('p2', 's1', 1)]
    const contentPages = pages.filter((p): p is PageReference => !p.isDivider)
    const resolved = resolvePagesToExport({
      pages,
      contentPages,
      contentPageCount: contentPages.length,
      pageRange: '2',
    })
    expect(resolved).toEqual([contentPages[1]!])
  })
})

describe('splitPagesIntoSegments', () => {
  it('splits pages on dividers', () => {
    const pages: PageEntry[] = [
      makePage('p1', 's1', 0),
      makePage('p2', 's1', 1),
      divider,
      makePage('p3', 's2', 0),
    ]

    const segments = splitPagesIntoSegments(pages)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toHaveLength(2)
    expect(segments[1]).toHaveLength(1)
  })
})
