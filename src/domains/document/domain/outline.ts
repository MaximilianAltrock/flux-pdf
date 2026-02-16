import { PAGE_NUMBER_BASE } from '@/shared/constants'
import type { OutlineNode, PageReference, PdfOutlineNode } from '@/shared/types'

export interface BuildOutlineOptions {
  filename: string
  outline?: PdfOutlineNode[]
  pageRefs: PageReference[]
  autoGenerateSinglePage?: boolean
}

export function buildOutlineForImport(options: BuildOutlineOptions): OutlineNode[] {
  const { filename, outline = [], pageRefs, autoGenerateSinglePage = true } = options
  if (!pageRefs.length) return []

  const pageIdByIndex = new Map<number, string>()
  for (const page of pageRefs) {
    if (!pageIdByIndex.has(page.sourcePageIndex)) {
      pageIdByIndex.set(page.sourcePageIndex, page.id)
    }
  }

  const mappedNodes = outline.length
    ? mapPdfOutlineToOutline(outline, pageIdByIndex, null)
    : []

  if (!mappedNodes.length) {
    if (pageRefs.length === 1 && !autoGenerateSinglePage) return []
    return [createRootNode(filename, pageRefs[0]!.id, [])]
  }

  if (mappedNodes.length === 1) {
    return mappedNodes
  }

  return [createRootNode(filename, pageRefs[0]!.id, mappedNodes, false)]
}

function createRootNode(
  title: string,
  targetPageId: string,
  children: OutlineNode[],
  expanded = true,
): OutlineNode {
  const id = crypto.randomUUID()
  return {
    id,
    parentId: null,
    title,
    expanded,
    dest: {
      type: 'page',
      targetPageId,
      fit: 'Fit',
    },
    children: children.map((child) => reparentNode(child, id)),
  }
}

function mapPdfOutlineToOutline(
  outline: PdfOutlineNode[],
  pageIdByIndex: Map<number, string>,
  parentId: string | null,
): OutlineNode[] {
  return outline.flatMap((item) => {
    const id = crypto.randomUUID()
    const children = mapPdfOutlineToOutline(item.children ?? [], pageIdByIndex, id)
    const pageId = pageIdByIndex.get(item.pageIndex)

    if (!pageId) {
      return reparentNodes(children, parentId)
    }

    const title = item.title.trim() || `Page ${item.pageIndex + PAGE_NUMBER_BASE}`

    const node: OutlineNode = {
      id,
      parentId,
      title,
      expanded: true,
      dest: {
        type: 'page',
        targetPageId: pageId,
        fit: 'Fit',
      },
      children,
    }

    return [node]
  })
}

function reparentNodes(nodes: OutlineNode[], parentId: string | null): OutlineNode[] {
  return nodes.map((node) => reparentNode(node, parentId))
}

function reparentNode(node: OutlineNode, parentId: string | null): OutlineNode {
  return {
    ...node,
    parentId,
    children: (node.children ?? []).map((child) => reparentNode(child, node.id)),
  }
}
