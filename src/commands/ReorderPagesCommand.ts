import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'

/**
 * Payload structure for serialization
 */
interface ReorderPagesPayload {
  id: string
  previousOrder: PageReference[]
  newOrder: PageReference[]
}

/**
 * Command to reorder pages via drag-and-drop
 *
 * Stores both the previous and new order of all pages,
 * allowing perfect restoration on undo.
 */
export class ReorderPagesCommand extends BaseCommand {
  public readonly type = CommandType.REORDER
  public readonly name = 'Reorder pages'

  /** Page order before the change */
  public readonly previousOrder: PageReference[]

  /** Page order after the change */
  public readonly newOrder: PageReference[]

  constructor(
    previousOrder: PageReference[],
    newOrder: PageReference[],
    id?: string,
    createdAt?: number,
  ) {
    super(id, createdAt)

    // Validate inputs
    if (!previousOrder || previousOrder.length === 0) {
      throw new Error('ReorderPagesCommand requires previousOrder')
    }
    if (!newOrder || newOrder.length === 0) {
      throw new Error('ReorderPagesCommand requires newOrder')
    }
    if (previousOrder.length !== newOrder.length) {
      throw new Error('ReorderPagesCommand: previousOrder and newOrder must have same length')
    }

    // Deep copy to ensure history doesn't mutate if store mutates
    this.previousOrder = BaseCommand.clonePages(previousOrder)
    this.newOrder = BaseCommand.clonePages(newOrder)
  }

  execute(): void {
    const store = useDocumentStore()
    store.reorderPages(BaseCommand.clonePages(this.newOrder))
  }

  undo(): void {
    const store = useDocumentStore()
    store.reorderPages(BaseCommand.clonePages(this.previousOrder))
  }

  protected getPayload(): Record<string, unknown> {
    return {
      previousOrder: this.previousOrder,
      newOrder: this.newOrder,
    }
  }

  /**
   * Reconstruct command from serialized data
   */
  static deserialize(data: SerializedCommand): ReorderPagesCommand {
    const payload = data.payload as unknown as ReorderPagesPayload
    return new ReorderPagesCommand(
      payload.previousOrder,
      payload.newOrder,
      payload.id,
      data.timestamp,
    )
  }
}

// Self-register with the command registry
registerCommand(CommandType.REORDER, ReorderPagesCommand)
