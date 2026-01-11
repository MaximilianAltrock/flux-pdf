import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFRef, PDFDict } from 'pdf-lib'
import type { BookmarkNode } from '@/types'

/**
 * Export-facing bookmark node.
 * This is what we feed into pdf-lib outline writer (pageIndex is final export order).
 */
export interface ExportBookmarkNode {
  title: string
  pageIndex: number
  children?: ExportBookmarkNode[]
  expanded?: boolean // true=open, false=closed (default true)
}

/**
 * Convert UI bookmark tree (pageId targets) into export nodes (pageIndex targets).
 * Bookmarks targeting deleted/missing pages are dropped (simple + predictable).
 */
export function mapBookmarksToExport(
  uiNodes: BookmarkNode[],
  pageIdToIndex: Map<string, number>,
): ExportBookmarkNode[] {
  const mapNode = (n: BookmarkNode): ExportBookmarkNode | null => {
    const pageIndex = pageIdToIndex.get(n.pageId)
    if (pageIndex == null) return null

    const children = (n.children ?? [])
      .map(mapNode)
      .filter((x): x is ExportBookmarkNode => x !== null)

    return {
      title: n.title,
      pageIndex,
      expanded: n.expanded,
      children: children.length ? children : undefined,
    }
  }

  return (uiNodes ?? []).map(mapNode).filter((x): x is ExportBookmarkNode => x !== null)
}

/**
 * Adds a hierarchical outline (bookmarks) to a PDFDocument.
 *
 * Notes:
 * - Rebuilds an outline tree from scratch.
 * - Sets /PageMode /UseOutlines so most viewers open the bookmark panel.
 * - Uses Dest with /FitH at top of page (robust "jump to page top" behavior).
 */
export async function addBookmarks(pdfDoc: PDFDocument, bookmarks: ExportBookmarkNode[]) {
  if (!bookmarks?.length) return

  const ctx = pdfDoc.context
  const outlineRef = ctx.nextRef()

  const outlineDict = ctx.obj({
    Type: PDFName.of('Outlines'),
    Count: PDFNumber.of(countVisible(bookmarks)),
  }) as PDFDict

  const { firstRef, lastRef } = await createOutlineItems(pdfDoc, bookmarks, outlineRef)

  outlineDict.set(PDFName.of('First'), firstRef)
  outlineDict.set(PDFName.of('Last'), lastRef)

  // Register outline root as an indirect object
  ctx.assign(outlineRef, outlineDict)

  // Hook into the catalog
  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef)
  pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

async function createOutlineItems(
  pdfDoc: PDFDocument,
  nodes: ExportBookmarkNode[],
  parentRef: PDFRef,
): Promise<{ firstRef: PDFRef; lastRef: PDFRef }> {
  const ctx = pdfDoc.context
  const refs: PDFRef[] = nodes.map(() => ctx.nextRef())

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    const ref = refs[i]!
    const prev = i > 0 ? refs[i - 1] : undefined
    const next = i < nodes.length - 1 ? refs[i + 1] : undefined

    const page = pdfDoc.getPage(node.pageIndex)

    // Destination array: [PageRef, /FitH, top]
    // This is generally more consistent than raw /XYZ coordinates.
    const dest = PDFArray.withContext(ctx)
    dest.push(page.ref)
    dest.push(PDFName.of('FitH'))
    dest.push(PDFNumber.of(page.getHeight()))

    const itemDict = ctx.obj({
      Title: PDFString.of(node.title),
      Parent: parentRef,
      Dest: dest,
      ...(prev ? { Prev: prev } : {}),
      ...(next ? { Next: next } : {}),
    }) as PDFDict

    if (node.children?.length) {
      const { firstRef, lastRef } = await createOutlineItems(pdfDoc, node.children, ref)

      itemDict.set(PDFName.of('First'), firstRef)
      itemDict.set(PDFName.of('Last'), lastRef)

      // Count is total descendants; sign indicates open (positive) or closed (negative)
      const descendants = countDescendants(node.children)
      const isOpen = node.expanded !== false
      itemDict.set(PDFName.of('Count'), PDFNumber.of(isOpen ? descendants : -descendants))
    }

    ctx.assign(ref, itemDict)
  }

  return { firstRef: refs[0]!, lastRef: refs[refs.length - 1]! }
}

// Total descendants (children + grandchildren + ...)
function countDescendants(nodes: ExportBookmarkNode[]): number {
  let count = 0
  for (const n of nodes) {
    count += 1
    if (n.children?.length) count += countDescendants(n.children)
  }
  return count
}

// Visible count respecting expanded/collapsed state (used for root /Outlines Count)
function countVisible(nodes: ExportBookmarkNode[]): number {
  let count = 0
  for (const n of nodes) {
    count += 1
    const isOpen = n.expanded !== false
    if (isOpen && n.children?.length) count += countVisible(n.children)
  }
  return count
}
