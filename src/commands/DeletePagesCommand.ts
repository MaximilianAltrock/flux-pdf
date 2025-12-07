import type { Command } from './types'
import type { PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'

/**
 * Command to delete one or more pages
 */
export class DeletePagesCommand implements Command {
  readonly id: string
  readonly name: string

  private pageIds: string[]
  private deletedPages: { page: PageReference; index: number }[] = []
  private store = useDocumentStore()

  constructor(pageIds: string[]) {
    this.id = crypto.randomUUID()
    this.pageIds = [...pageIds]

    const count = pageIds.length
    this.name = count === 1 ? 'Delete page' : `Delete ${count} pages`
  }

  execute(): void {
    // Store pages and their indices before deletion (in reverse order for proper restoration)
    this.deletedPages = []

    for (const pageId of this.pageIds) {
      const index = this.store.pages.findIndex(p => p.id === pageId)
      if (index !== -1) {
        const page = this.store.pages[index]
        if (page) {
          this.deletedPages.push({
            page: { ...page },
            index
          })
        }
      }
    }

    // Sort by index descending so we delete from end first
    this.deletedPages.sort((a, b) => b.index - a.index)

    // Perform deletion
    this.store.removePages(this.pageIds)
  }

  undo(): void {
    // Restore pages in ascending index order
    const sorted = [...this.deletedPages].sort((a, b) => a.index - b.index)

    for (const { page, index } of sorted) {
      this.store.insertPages(index, [page])
    }
  }
}
