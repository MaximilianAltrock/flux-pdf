import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { PageEntry } from '@/shared/types'
import { clonePageEntries } from '@/shared/utils/document-clone'

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
  public readonly previousOrder: PageEntry[]

  /** Page order after the change */
  public readonly newOrder: PageEntry[]

  constructor(previousOrder: PageEntry[], newOrder: PageEntry[], id?: string, createdAt?: number) {
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

    this.previousOrder = clonePageEntries(previousOrder)
    this.newOrder = clonePageEntries(newOrder)
  }

  protected getPayload(): Record<string, unknown> {
    return {
      previousOrder: clonePageEntries(this.previousOrder),
      newOrder: clonePageEntries(this.newOrder),
    }
  }

  static deserialize(data: SerializedCommand): ReorderPagesCommand {
    const { previousOrder, newOrder, id } = data.payload as {
      id: string
      previousOrder: PageEntry[]
      newOrder: PageEntry[]
    }
    return new ReorderPagesCommand(previousOrder, newOrder, id, data.timestamp)
  }
}

registerCommand(CommandType.REORDER, ReorderPagesCommand)

