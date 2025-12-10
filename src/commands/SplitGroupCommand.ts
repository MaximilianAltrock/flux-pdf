import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'
import { CommandType } from './registry'

export class SplitGroupCommand implements Command {
  public readonly type = CommandType.SPLIT
  public readonly id: string
  public readonly name = 'Split Group'

  public index: number
  public divider: PageReference

  constructor(index: number) {
    this.id = crypto.randomUUID()
    this.index = index

    // Create the divider instance immediately so it persists
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
    // Insert the specific divider object instance
    store.insertPages(this.index, [this.divider])
  }

  undo(): void {
    const store = useDocumentStore()
    // Remove the divider by ID
    store.deletePages([this.divider.id])
  }
}
