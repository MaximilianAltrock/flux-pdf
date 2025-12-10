import type { Command } from './types'
import type { PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'
import { CommandType } from './registry'

interface PageSnapshot {
  page: PageReference
  index: number
}

export class DeletePagesCommand implements Command {
  public readonly type = CommandType.DELETE
  public readonly id: string
  public readonly name: string

  public pageIds: string[]

  // Stores the state of pages BEFORE they were deleted.
  // Must be public for serialization/persistence.
  public backupSnapshots: PageSnapshot[] = []

  constructor(pageIds: string[]) {
    this.id = crypto.randomUUID()
    this.pageIds = [...pageIds]
    const count = pageIds.length
    this.name = count === 1 ? 'Delete page' : `Delete ${count} pages`
  }

  execute(): void {
    const store = useDocumentStore()

    // 1. If this is the first run (not a redo), capture the state
    if (this.backupSnapshots.length === 0) {
      store.pages.forEach((page, index) => {
        if (this.pageIds.includes(page.id)) {
          this.backupSnapshots.push({
            page: { ...page },
            index,
          })
        }
      })
    }

    // 2. Perform Delete
    store.deletePages(this.pageIds)
  }

  undo(): void {
    const store = useDocumentStore()

    // 3. Restore in correct order (Index Ascending)
    // Sorting ensures that if we restore index 5 and 10,
    // index 10 lands in the correct spot relative to 5.
    const sorted = [...this.backupSnapshots].sort((a, b) => a.index - b.index)

    for (const { page, index } of sorted) {
      store.insertPages(index, [page])
    }
  }
}
