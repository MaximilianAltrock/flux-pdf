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

function omitUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, nested]) => nested !== undefined),
  ) as T
}

export function cloneRedactionMark(value: RedactionMark): RedactionMark {
  return omitUndefinedProperties({
    ...value,
  })
}

export function clonePageReference(value: PageReference): PageReference {
  return omitUndefinedProperties({
    ...value,
    targetDimensions: value.targetDimensions ? { ...value.targetDimensions } : undefined,
    redactions: value.redactions?.map(cloneRedactionMark),
  })
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
  return omitUndefinedProperties({
    ...value,
  })
}

export function cloneDocumentMetadata(value: DocumentMetadata): DocumentMetadata {
  return omitUndefinedProperties({
    ...value,
    keywords: [...value.keywords],
  })
}

export function clonePdfOutlineNode(value: PdfOutlineNode): PdfOutlineNode {
  return omitUndefinedProperties({
    title: value.title,
    pageIndex: value.pageIndex,
    children: value.children?.map(clonePdfOutlineNode),
  })
}

export function cloneOutlineNode(value: OutlineNode): OutlineNode {
  return omitUndefinedProperties({
    ...value,
    dest: omitUndefinedProperties({ ...value.dest }),
    children: (value.children ?? []).map(cloneOutlineNode),
  })
}

export function cloneOutlineTree(values: ReadonlyArray<OutlineNode>): OutlineNode[] {
  return values.map(cloneOutlineNode)
}

export function cloneSourceFile(value: SourceFile): SourceFile {
  return omitUndefinedProperties({
    ...value,
    pageMetaData: value.pageMetaData.map(clonePageMetrics),
    outline: value.outline?.map(clonePdfOutlineNode),
    metadata: value.metadata ? cloneDocumentMetadata(value.metadata) : undefined,
  })
}
