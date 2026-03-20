import { describe, expect, it } from 'vitest'
import { createDocumentState } from '@/domains/project-session/session/document-state'
import type { PageReference, SourceFile } from '@/shared/types'

function createSource(id: string, pageCount = 1): SourceFile {
  return {
    id,
    filename: `${id}.pdf`,
    pageCount,
    fileSize: 1024,
    addedAt: Date.now(),
    color: 'zinc',
    pageMetaData: Array.from({ length: pageCount }, () => ({
      width: 612,
      height: 792,
      rotation: 0,
    })),
  }
}

function createPage(id: string, sourceFileId: string, sourcePageIndex = 0): PageReference {
  return {
    id,
    sourceFileId,
    sourcePageIndex,
    rotation: 0,
    width: 612,
    height: 792,
  }
}

describe('document-state batch mutations', () => {
  it('inserts multiple page batches while bumping structure version once', () => {
    const store = createDocumentState()
    store.addPages([
      createPage('page-1', 'source-1'),
      createPage('page-3', 'source-1', 2),
    ])
    const previousVersion = store.pagesStructureVersion

    store.insertPagesBatch([
      { index: 1, pages: [createPage('page-2', 'source-1', 1)] },
      { index: 3, pages: [createPage('page-4', 'source-1', 3)] },
    ])

    expect(store.contentPages.map((page) => page.id)).toEqual([
      'page-1',
      'page-2',
      'page-3',
      'page-4',
    ])
    expect(store.pagesStructureVersion).toBe(previousVersion + 1)
  })

  it('rotates multiple pages while bumping page version once', () => {
    const store = createDocumentState()
    store.addPages([
      createPage('page-1', 'source-1'),
      createPage('page-2', 'source-1', 1),
      createPage('page-3', 'source-1', 2),
    ])
    const previousVersion = store.pagesVersion

    store.rotatePages(['page-1', 'page-3'], 90)

    expect(store.contentPages.map((page) => page.rotation)).toEqual([90, 0, 90])
    expect(store.pagesVersion).toBe(previousVersion + 1)
  })

  it('updates multiple target dimensions while bumping page version once', () => {
    const store = createDocumentState()
    store.addSourceFile(createSource('source-1', 2))
    store.addPages([
      createPage('page-1', 'source-1'),
      createPage('page-2', 'source-1', 1),
    ])
    const previousVersion = store.pagesVersion

    store.setPageTargetDimensionsBatch([
      { pageId: 'page-1', targetDimensions: { width: 700, height: 900 } },
      { pageId: 'page-2', targetDimensions: { width: 800, height: 1000 } },
    ])

    expect(store.contentPages[0]?.targetDimensions).toEqual({ width: 700, height: 900 })
    expect(store.contentPages[1]?.targetDimensions).toEqual({ width: 800, height: 1000 })
    expect(store.pagesVersion).toBe(previousVersion + 1)
  })
})
