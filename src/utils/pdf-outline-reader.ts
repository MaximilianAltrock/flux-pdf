import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfOutlineNode } from '@/types'

type PdfJsOutlineItem = {
  title?: string
  dest?: unknown
  items?: PdfJsOutlineItem[]
}

export async function extractPdfOutline(pdfDoc: PDFDocumentProxy): Promise<PdfOutlineNode[]> {
  try {
    const outline = await pdfDoc.getOutline()
    if (!outline || outline.length === 0) return []
    return await mapItems(pdfDoc, outline)
  } catch (error) {
    console.warn('Failed to read PDF outline', error)
    return []
  }
}

async function mapItems(
  pdfDoc: PDFDocumentProxy,
  items: PdfJsOutlineItem[],
): Promise<PdfOutlineNode[]> {
  const nodes: PdfOutlineNode[] = []

  for (const item of items) {
    const children = await mapItems(pdfDoc, item.items ?? [])
    const pageIndex = await resolvePageIndex(pdfDoc, item.dest)

    if (pageIndex == null) {
      if (children.length) nodes.push(...children)
      continue
    }

    const title = typeof item.title === 'string' ? item.title.trim() : ''

    nodes.push({
      title: title || 'Untitled',
      pageIndex,
      children: children.length ? children : undefined,
    })
  }

  return nodes
}

async function resolvePageIndex(
  pdfDoc: PDFDocumentProxy,
  dest: unknown,
): Promise<number | null> {
  if (!dest) return null

  let resolved: unknown = dest
  if (typeof dest === 'string') {
    resolved = await pdfDoc.getDestination(dest)
  }

  if (!Array.isArray(resolved) || resolved.length === 0) return null

  const pageRef = resolved[0]
  if (typeof pageRef === 'number') {
    return pageRef >= 0 ? pageRef : null
  }

  try {
    const idx = await pdfDoc.getPageIndex(pageRef as any)
    return idx >= 0 ? idx : null
  } catch {
    return null
  }
}
