import { PAGE_NUMBER_BASE } from '@/shared/constants'
import type { PageReference, SourceFile, OutlineNode } from '@/shared/types'

export function autoGenOutlineFromPages(
  pages: PageReference[],
  sources: Map<string, SourceFile>,
): OutlineNode[] {
  const blocks: Array<{
    sourceId: string
    firstPageId: string
    startPageNumber: number
  }> = []
  let current: { sourceId: string; firstPageId: string; startPageNumber: number } | null =
    null
  let pageNumber = PAGE_NUMBER_BASE - 1

  for (const page of pages) {
    if (page.isDivider) continue
    pageNumber += 1

    if (!current || page.sourceFileId !== current.sourceId) {
      if (current) blocks.push(current)
      current = {
        sourceId: page.sourceFileId,
        firstPageId: page.id,
        startPageNumber: pageNumber,
      }
    }
  }

  if (current) blocks.push(current)

  return blocks.map((block) => {
    const src = sources.get(block.sourceId)
    const filename = src?.filename ?? 'Unknown Source'
    const title = filename.replace(/\.pdf$/i, '')

    return {
      id: crypto.randomUUID(),
      parentId: null,
      title,
      expanded: true,
      dest: {
        type: 'page',
        targetPageId: block.firstPageId,
        fit: 'Fit',
      },
      children: [],
    }
  })
}
