import type {
  DocumentMetadata,
  DividerReference,
  OutlineNode,
  PageEntry,
  PageMetrics,
  PageReference,
  PdfOutlineNode,
  RedactionMark,
  SourceFile,
} from '@/shared/types'
import { isDividerEntry } from '@/shared/types'

export function cloneRedactionMark(value: RedactionMark): RedactionMark {
  return { ...value }
}

export function clonePageReference(value: PageReference): PageReference {
  return {
    ...value,
    targetDimensions: value.targetDimensions ? { ...value.targetDimensions } : undefined,
    redactions: value.redactions?.map(cloneRedactionMark),
  }
}

export function cloneDividerReference(value: DividerReference): DividerReference {
  return {
    id: value.id,
    isDivider: true,
  }
}

export function clonePageEntry(value: PageEntry): PageEntry {
  if (isDividerEntry(value)) {
    return cloneDividerReference(value)
  }
  return clonePageReference(value)
}

export function clonePageEntries(values: ReadonlyArray<PageEntry>): PageEntry[] {
  return values.map(clonePageEntry)
}

export function clonePageReferences(values: ReadonlyArray<PageReference>): PageReference[] {
  return values.map(clonePageReference)
}

export function clonePageMetrics(value: PageMetrics): PageMetrics {
  return { ...value }
}

export function cloneDocumentMetadata(value: DocumentMetadata): DocumentMetadata {
  return {
    ...value,
    keywords: [...value.keywords],
  }
}

export function clonePdfOutlineNode(value: PdfOutlineNode): PdfOutlineNode {
  return {
    title: value.title,
    pageIndex: value.pageIndex,
    children: value.children?.map(clonePdfOutlineNode),
  }
}

export function cloneOutlineNode(value: OutlineNode): OutlineNode {
  return {
    ...value,
    dest: { ...value.dest },
    children: value.children.map(cloneOutlineNode),
  }
}

export function cloneOutlineTree(values: ReadonlyArray<OutlineNode>): OutlineNode[] {
  return values.map(cloneOutlineNode)
}

export function cloneSourceFile(value: SourceFile): SourceFile {
  return {
    ...value,
    pageMetaData: value.pageMetaData.map(clonePageMetrics),
    outline: value.outline?.map(clonePdfOutlineNode),
    metadata: value.metadata ? cloneDocumentMetadata(value.metadata) : undefined,
  }
}
