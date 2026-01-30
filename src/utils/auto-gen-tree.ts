import { PAGE_NUMBER_BASE } from '@/constants'
import type { PageReference, SourceFile, BookmarkNode, PdfOutlineNode } from '@/types'

export function autoGenBookmarksFromPages(
  pages: PageReference[],
  sources: Map<string, SourceFile>,
): BookmarkNode[] {
  const blocks: { sourceId: string; pages: PageReference[] }[] = []
  let currentBlock: { sourceId: string; pages: PageReference[] } | null = null

  for (const page of pages) {
    if (page.isDivider) continue

    if (!currentBlock || page.sourceFileId !== currentBlock.sourceId) {
      if (currentBlock) blocks.push(currentBlock)
      currentBlock = { sourceId: page.sourceFileId, pages: [] }
    }

    currentBlock.pages.push(page)
  }

  if (currentBlock) blocks.push(currentBlock)

  const roots: BookmarkNode[] = []

  for (const [blockIndex, block] of blocks.entries()) {
    const src = sources.get(block.sourceId)
    const filename = src?.filename ?? 'Unknown Source'
    const title = filename.replace(/\.pdf$/i, '')
    const rootPageId = block.pages[0]?.id

    if (!rootPageId) continue

    const pageIdByIndex = new Map<number, string>()
    for (const page of block.pages) {
      if (!pageIdByIndex.has(page.sourcePageIndex)) {
        pageIdByIndex.set(page.sourcePageIndex, page.id)
      }
    }

    const outlineNodes = src?.outline ?? []
    let children = outlineNodes.length
      ? mapOutlineToBookmarks(outlineNodes, pageIdByIndex, block.sourceId)
      : []

    if (!children.length) {
      children = mapPagesToBookmarks(block.pages)
    }

    roots.push({
      id: `root:${block.sourceId}:${blockIndex}`,
      title,
      pageId: rootPageId,
      children,
      expanded: true,
    })
  }

  return roots
}

function mapOutlineToBookmarks(
  outline: PdfOutlineNode[],
  pageIdByIndex: Map<number, string>,
  sourceId: string,
  path: number[] = [],
): BookmarkNode[] {
  const nodes: BookmarkNode[] = []

  outline.forEach((item, index) => {
    const nextPath = [...path, index]
    const children = mapOutlineToBookmarks(
      item.children ?? [],
      pageIdByIndex,
      sourceId,
      nextPath,
    )
    const pageId = pageIdByIndex.get(item.pageIndex)

    if (!pageId) {
      if (children.length) nodes.push(...children)
      return
    }

    const title = item.title.trim() || `Page ${item.pageIndex + PAGE_NUMBER_BASE}`

    nodes.push({
      id: `outline:${sourceId}:${nextPath.join('.')}:${pageId}`,
      title,
      pageId,
      children,
      expanded: true,
    })
  })

  return nodes
}

function mapPagesToBookmarks(pages: PageReference[]): BookmarkNode[] {
  return pages.map((page) => ({
    id: `page:${page.id}`,
    title: `Page ${page.sourcePageIndex + PAGE_NUMBER_BASE}`,
    pageId: page.id,
    children: [],
    expanded: true,
  }))
}
