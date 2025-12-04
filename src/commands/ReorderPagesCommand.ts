import type { Command } from './types'
import type { PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'

/**
 * Command to reorder pages (used after drag and drop)
 */
export class ReorderPagesCommand implements Command {
  readonly id: string
  readonly name = 'Reorder pages'
  
  private previousOrder: PageReference[]
  private newOrder: PageReference[]
  private store = useDocumentStore()

  constructor(previousOrder: PageReference[], newOrder: PageReference[]) {
    this.id = crypto.randomUUID()
    // Deep copy to prevent reference issues
    this.previousOrder = previousOrder.map(p => ({ ...p }))
    this.newOrder = newOrder.map(p => ({ ...p }))
  }

  execute(): void {
    this.store.reorderPages(this.newOrder.map(p => ({ ...p })))
  }

  undo(): void {
    this.store.reorderPages(this.previousOrder.map(p => ({ ...p })))
  }
}
