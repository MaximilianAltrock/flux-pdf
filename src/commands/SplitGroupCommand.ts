import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'
import { CommandType } from './registry'

export class SplitGroupCommand implements Command {
  public readonly type = CommandType.SPLIT
  public readonly id: string
  public readonly name = 'Split Group'

  public index: number
  // Make mutable so registry can restore it
  public divider: PageReference

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
    const store = useDocumentStore()
    // Check if we are re-executing (Redo).
    // If the divider is already in the store (unlikely in pure redo, but possible in edge cases),
    // we should ensure we don't duplicate it, but typically insertPages handles placement.
    store.insertPages(this.index, [this.divider])
  }

  undo(): void {
    const store = useDocumentStore()
    store.deletePages([this.divider.id])
  }
}
