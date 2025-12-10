import type { Command } from './types'
import type { PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'
import { CommandType } from './registry'

export class ReorderPagesCommand implements Command {
  public readonly type = CommandType.REORDER
  public readonly id: string
  public readonly name = 'Reorder pages'

  // Public for serialization
  public previousOrder: PageReference[]
  public newOrder: PageReference[]

  constructor(previousOrder: PageReference[], newOrder: PageReference[]) {
    this.id = crypto.randomUUID()
    // Deep copy to ensure history doesn't mutate if store mutates
    this.previousOrder = previousOrder.map((p) => ({ ...p }))
    this.newOrder = newOrder.map((p) => ({ ...p }))
  }

  execute(): void {
    const store = useDocumentStore()
    store.reorderPages(this.newOrder.map((p) => ({ ...p })))
  }

  undo(): void {
    const store = useDocumentStore()
    store.reorderPages(this.previousOrder.map((p) => ({ ...p })))
  }
}
