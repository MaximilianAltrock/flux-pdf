import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'

export class SplitGroupCommand implements Command {
  id = 'split-group'
  name = 'Split Group'

  private store = useDocumentStore()
  private divider: PageReference
  private index: number

  constructor(index: number) {
    this.index = index
    this.divider = {
      id: crypto.randomUUID(),
      sourceFileId: 'virtual-divider',
      sourcePageIndex: -1,
      rotation: 0,
      isDivider: true,
      groupId: crypto.randomUUID()
    }
  }

  execute(): void {
    // Insert divider at index
    this.store.pages.splice(this.index, 0, this.divider)
  }

  undo(): void {
    // Finds and removes the divider by ID
    const idx = this.store.pages.findIndex(p => p.id === this.divider.id)
    if (idx !== -1) {
      this.store.pages.splice(idx, 1)
    }
  }
}
