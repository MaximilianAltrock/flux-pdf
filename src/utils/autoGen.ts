import type { PageReference, SourceFile, UiBookmarkNode, PdfOutlineNode } from '@/types'

export function autoGenBookmarksFromPages(
  pages: PageReference[],
  sources: Map<string, SourceFile>,
): UiBookmarkNode[] {
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

  const roots: UiBookmarkNode[] = []

  for (const block of blocks) {
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
      ? mapOutlineToBookmarks(outlineNodes, pageIdByIndex)
      : []

    if (!children.length) {
      children = mapPagesToBookmarks(block.pages)
    }

    roots.push({
      id: crypto.randomUUID(),
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
): UiBookmarkNode[] {
  const nodes: UiBookmarkNode[] = []

  for (const item of outline) {
    const children = mapOutlineToBookmarks(item.children ?? [], pageIdByIndex)
    const pageId = pageIdByIndex.get(item.pageIndex)

    if (!pageId) {
      if (children.length) nodes.push(...children)
      continue
    }

    const title = item.title.trim() || `Page ${item.pageIndex + 1}`

    nodes.push({
      id: crypto.randomUUID(),
      title,
      pageId,
      children,
      expanded: true,
    })
  }

  return nodes
}

function mapPagesToBookmarks(pages: PageReference[]): UiBookmarkNode[] {
  return pages.map((page) => ({
    id: crypto.randomUUID(),
    title: `Page ${page.sourcePageIndex + 1}`,
    pageId: page.id,
    children: [],
    expanded: true,
  }))
}
