import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand, PageSnapshot } from './types'
import { clonePageReference } from '@/shared/utils/document-clone'

/**
 * Command to delete one or more pages
 *
 * Captures page state before deletion so they can be
 * perfectly restored on undo, including original positions.
 */
export class DeletePagesCommand extends BaseCommand {
  public readonly type = CommandType.DELETE
  public readonly name: string

  /** IDs of pages to delete */
  public readonly pageIds: string[]

  /**
   * Snapshots of pages BEFORE deletion
   * Populated on first execute(), restored on undo()
   */
  public backupSnapshots: PageSnapshot[] = []

  constructor(
    pageIds: string[],
    id?: string,
    backupSnapshots?: PageSnapshot[],
    createdAt?: number,
  ) {
    super(id, createdAt)

    // Validate inputs
    if (!pageIds || pageIds.length === 0) {
      throw new Error('DeletePagesCommand requires at least one page ID')
    }

    this.pageIds = [...pageIds]
    this.name = pageIds.length === 1 ? 'Delete page' : `Delete ${pageIds.length} pages`

    // Restore backup snapshots if provided (from deserialization)
    if (backupSnapshots) {
      this.backupSnapshots = backupSnapshots.map((s) => ({
        page: clonePageReference(s.page),
        index: s.index,
      }))
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      pageIds: this.pageIds,
      backupSnapshots: this.backupSnapshots.map((s) => ({
        page: clonePageReference(s.page),
        index: s.index,
      })),
    }
  }

  static deserialize(data: SerializedCommand): DeletePagesCommand {
    const { id, pageIds, backupSnapshots } = data.payload as {
      id: string
      pageIds: string[]
      backupSnapshots: PageSnapshot[]
    }
    return new DeletePagesCommand(pageIds, id, backupSnapshots, data.timestamp)
  }
}

registerCommand(CommandType.DELETE, DeletePagesCommand)

