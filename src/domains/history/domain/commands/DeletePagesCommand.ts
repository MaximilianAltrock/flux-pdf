import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand, PageSnapshot } from './types'
import { useDocumentStore } from '@/stores/document'

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
  private backupSnapshots: PageSnapshot[] = []

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

    // TODO: Move defensive copying to store layer
    this.pageIds = [...pageIds]
    this.name = pageIds.length === 1 ? 'Delete page' : `Delete ${pageIds.length} pages`

    // Restore backup snapshots if provided (from deserialization)
    if (backupSnapshots) {
      // TODO: Move defensive copying to store layer
      this.backupSnapshots = backupSnapshots.map((s) => ({
        page: { ...s.page },
        index: s.index,
      }))
    }
  }

  execute(): void {
    const store = useDocumentStore()

    // Capture state on first execution (not on redo)
    if (this.backupSnapshots.length === 0) {
      this.captureSnapshots(store)
    }

    // Perform deletion
    store.deletePages(this.pageIds)
  }

  undo(): void {
    const store = useDocumentStore()

    // Restore pages in correct order (ascending index)
    // This ensures page 5 is inserted before page 10,
    // so indices remain valid during restoration
    const sorted = [...this.backupSnapshots].sort((a, b) => a.index - b.index)

    for (const { page, index } of sorted) {
      // TODO: Move defensive copying to store layer
      store.insertPages(index, [{ ...page }])
    }
  }

  /**
   * Capture snapshots of pages before deletion
   */
  private captureSnapshots(store: ReturnType<typeof useDocumentStore>): void {
    const pageIdSet = new Set(this.pageIds)

    store.pages.forEach((page, index) => {
      if (page.isDivider) return
      if (pageIdSet.has(page.id)) {
        this.backupSnapshots.push({
          page: { ...page },
          index,
        })
      }
    })
  }

  protected getPayload(): Record<string, unknown> {
    return {
      pageIds: this.pageIds,
      // TODO: Move defensive copying to store layer
      backupSnapshots: this.backupSnapshots.map((s) => ({
        page: { ...s.page },
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
