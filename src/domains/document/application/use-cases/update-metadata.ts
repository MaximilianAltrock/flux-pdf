import type { DocumentMetadata } from '@/types'

export interface MetadataStoreContract {
  setMetadata: (next: Partial<DocumentMetadata>, markDirty?: boolean) => void
}

export function updateMetadata(
  store: MetadataStoreContract,
  updates: Partial<DocumentMetadata>,
  options: { markDirty?: boolean } = {},
): void {
  store.setMetadata(updates, options.markDirty ?? true)
}
