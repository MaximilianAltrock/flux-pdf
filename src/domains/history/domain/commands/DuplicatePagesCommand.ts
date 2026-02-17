import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'

/**
 * Command to duplicate one or more pages
 *
 * Duplicates are inserted immediately after their source pages.
 * On undo, the exact same pages are removed.
 * On redo, the exact same IDs are reused to maintain consistency.
 */
export class DuplicatePagesCommand extends BaseCommand {
  public readonly type = CommandType.DUPLICATE
  public readonly name: string

  /** IDs of pages to duplicate */
  public readonly sourcePageIds: string[]

  /**
   * IDs of pages created by this command
   * Populated on first execute(), reused on redo
   */
  public createdPageIds: string[] = []

  constructor(sourcePageIds: string[], id?: string, createdPageIds?: string[], createdAt?: number) {
    super(id, createdAt)

    // Validate inputs
    if (!sourcePageIds || sourcePageIds.length === 0) {
      throw new Error('DuplicatePagesCommand requires at least one source page ID')
    }

    this.sourcePageIds = [...sourcePageIds]
    this.name =
      sourcePageIds.length === 1 ? 'Duplicate page' : `Duplicate ${sourcePageIds.length} pages`

    // Restore created IDs if provided (from deserialization)
    if (createdPageIds) {
      this.createdPageIds = [...createdPageIds]
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourcePageIds: [...this.sourcePageIds],
      createdPageIds: [...this.createdPageIds],
    }
  }

  static deserialize(data: SerializedCommand): DuplicatePagesCommand {
    const { id, sourcePageIds, createdPageIds } = data.payload as {
      id: string
      sourcePageIds: string[]
      createdPageIds: string[]
    }
    return new DuplicatePagesCommand(sourcePageIds, id, createdPageIds, data.timestamp)
  }
}

registerCommand(CommandType.DUPLICATE, DuplicatePagesCommand)

