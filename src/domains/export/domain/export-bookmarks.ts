import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFRef,
  PDFString,
} from 'pdf-lib'
import type { OutlineNode } from '@/shared/types'
import type { ExportBookmarkNode } from '@/domains/export/domain/export-types'

export function mapBookmarksToExport(
  uiNodes: OutlineNode[],
  pageIdToIndex: Map<string, number>,
  pageIdToDocIndex?: Map<string, number>,
): ExportBookmarkNode[] {
  const exportDocOrder = buildExportDocOrder(pageIdToIndex, pageIdToDocIndex)

  const resolvePageIndex = (pageId: string): number | null => {
    const direct = pageIdToIndex.get(pageId)
    if (direct != null) return direct
    if (!pageIdToDocIndex) return null
    const docIndex = pageIdToDocIndex.get(pageId)
    if (docIndex == null) return null
    return findNearestExportIndex(docIndex, exportDocOrder)
  }

  const mapNode = (node: OutlineNode): ExportBookmarkNode[] => {
    const children = (node.children ?? []).flatMap(mapNode)

    if (node.dest.type === 'page') {
      const pageId = node.dest.targetPageId
      if (!pageId) return children
      const pageIndex = resolvePageIndex(pageId)
      if (pageIndex == null) return children
      return [
        {
          title: node.title,
          dest: {
            type: 'page',
            pageIndex,
            fit: node.dest.fit ?? 'Fit',
            zoom: node.dest.zoom,
            y: node.dest.y,
          },
          color: node.color,
          isBold: node.isBold,
          isItalic: node.isItalic,
          expanded: node.expanded,
          children: children.length ? children : undefined,
        },
      ]
    }

    if (node.dest.type === 'external-url' && node.dest.url) {
      return [
        {
          title: node.title,
          dest: { type: 'external-url', url: node.dest.url },
          color: node.color,
          isBold: node.isBold,
          isItalic: node.isItalic,
          expanded: node.expanded,
          children: children.length ? children : undefined,
        },
      ]
    }

    return [
      {
        title: node.title,
        dest: { type: 'none' },
        color: node.color,
        isBold: node.isBold,
        isItalic: node.isItalic,
        expanded: node.expanded,
        children: children.length ? children : undefined,
      },
    ]
  }

  return (uiNodes ?? []).flatMap(mapNode)
}

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

  ctx.assign(outlineRef, outlineDict)

  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef)
  pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

export function flattenExportBookmarks(nodes: ExportBookmarkNode[]): ExportBookmarkNode[] {
  const result: ExportBookmarkNode[] = []
  const walk = (items: ExportBookmarkNode[]) => {
    for (const item of items) {
      result.push({ ...item, children: undefined })
      if (item.children?.length) walk(item.children)
    }
  }
  walk(nodes)
  return result
}

export function applyExpandedState(
  nodes: ExportBookmarkNode[],
  expanded: boolean,
): ExportBookmarkNode[] {
  return nodes.map((node) => ({
    ...node,
    expanded,
    children: node.children ? applyExpandedState(node.children, expanded) : undefined,
  }))
}

function buildExportDocOrder(
  pageIdToIndex: Map<string, number>,
  pageIdToDocIndex?: Map<string, number>,
): Array<{ docIndex: number; exportIndex: number }> {
  if (!pageIdToDocIndex) return []
  const order: Array<{ docIndex: number; exportIndex: number }> = []
  for (const [pageId, exportIndex] of pageIdToIndex) {
    const docIndex = pageIdToDocIndex.get(pageId)
    if (docIndex == null) continue
    order.push({ docIndex, exportIndex })
  }
  order.sort((a, b) => a.docIndex - b.docIndex)
  return order
}

function findNearestExportIndex(
  docIndex: number,
  exportDocOrder: Array<{ docIndex: number; exportIndex: number }>,
): number | null {
  if (!exportDocOrder.length) return null
  let low = 0
  let high = exportDocOrder.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const midDocIndex = exportDocOrder[mid]!.docIndex
    if (midDocIndex === docIndex) {
      return exportDocOrder[mid]!.exportIndex
    }
    if (midDocIndex < docIndex) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  const before = exportDocOrder[low - 1]
  const after = exportDocOrder[low]

  if (!before) return after?.exportIndex ?? null
  if (!after) return before.exportIndex

  const beforeDistance = Math.abs(before.docIndex - docIndex)
  const afterDistance = Math.abs(after.docIndex - docIndex)
  return beforeDistance <= afterDistance ? before.exportIndex : after.exportIndex
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

    const itemDict = ctx.obj({
      Title: PDFString.of(node.title),
      Parent: parentRef,
      ...(prev ? { Prev: prev } : {}),
      ...(next ? { Next: next } : {}),
    }) as PDFDict

    if (node.dest.type === 'page') {
      const page = pdfDoc.getPage(node.dest.pageIndex)
      const dest = PDFArray.withContext(ctx)
      dest.push(page.ref)
      if (node.dest.fit === 'XYZ') {
        dest.push(PDFName.of('XYZ'))
        dest.push(PDFNull)
        dest.push(
          typeof node.dest.y === 'number'
            ? PDFNumber.of(node.dest.y)
            : PDFNumber.of(page.getHeight()),
        )
        dest.push(typeof node.dest.zoom === 'number' ? PDFNumber.of(node.dest.zoom) : PDFNull)
      } else {
        dest.push(PDFName.of('Fit'))
      }
      itemDict.set(PDFName.of('Dest'), dest)
    } else if (node.dest.type === 'external-url') {
      const action = ctx.obj({
        S: PDFName.of('URI'),
        URI: PDFString.of(node.dest.url),
      }) as PDFDict
      itemDict.set(PDFName.of('A'), action)
    }

    if (node.color) {
      const rgb = parseOutlineColor(node.color)
      if (rgb) {
        const color = PDFArray.withContext(ctx)
        color.push(PDFNumber.of(rgb[0]))
        color.push(PDFNumber.of(rgb[1]))
        color.push(PDFNumber.of(rgb[2]))
        itemDict.set(PDFName.of('C'), color)
      }
    }

    const flags = (node.isItalic ? 1 : 0) | (node.isBold ? 2 : 0)
    if (flags > 0) {
      itemDict.set(PDFName.of('F'), PDFNumber.of(flags))
    }

    if (node.children?.length) {
      const { firstRef, lastRef } = await createOutlineItems(pdfDoc, node.children, ref)

      itemDict.set(PDFName.of('First'), firstRef)
      itemDict.set(PDFName.of('Last'), lastRef)

      const descendants = countDescendants(node.children)
      const isOpen = node.expanded !== false
      itemDict.set(PDFName.of('Count'), PDFNumber.of(isOpen ? descendants : -descendants))
    }

    ctx.assign(ref, itemDict)
  }

  return { firstRef: refs[0]!, lastRef: refs[refs.length - 1]! }
}

function parseOutlineColor(value: string): [number, number, number] | null {
  const hex = value.trim().replace('#', '')
  if (hex.length !== 6) return null
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some((component) => Number.isNaN(component))) return null
  return [r / 255, g / 255, b / 255]
}

function countDescendants(nodes: ExportBookmarkNode[]): number {
  let count = 0
  for (const node of nodes) {
    count += 1
    if (node.children?.length) count += countDescendants(node.children)
  }
  return count
}

function countVisible(nodes: ExportBookmarkNode[]): number {
  let count = 0
  for (const node of nodes) {
    count += 1
    const isOpen = node.expanded !== false
    if (isOpen && node.children?.length) count += countVisible(node.children)
  }
  return count
}
