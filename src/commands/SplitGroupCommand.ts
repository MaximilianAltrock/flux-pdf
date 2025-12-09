import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'

export class SplitGroupCommand implements Command {
  readonly id: string
  readonly name = 'Split Group'

  private store = useDocumentStore()
  private divider: PageReference
  private index: number

  constructor(index: number) {
    this.id = crypto.randomUUID()
    this.index = index
    this.divider = {
      id: crypto.randomUUID(),
      sourceFileId: 'virtual-divider',
      sourcePageIndex: -1,
      rotation: 0,
      isDivider: true,
      groupId: crypto.randomUUID(),
    }
  }

  execute(): void {
    // Insert divider at index using store action
    this.store.insertPages(this.index, [this.divider])
  }

  undo(): void {
    // Remove the divider by ID using store action
    this.store.deletePages([this.divider.id])
  }
}
