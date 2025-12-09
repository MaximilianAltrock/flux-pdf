import type { Command } from './types'
import type { PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'

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
    // 1. Capture state before deletion
    this.deletedPages = []

    // We iterate store pages to find indices.
    // Important: We must capture the exact object state.
    this.store.pages.forEach((page, index) => {
      if (this.pageIds.includes(page.id)) {
        this.deletedPages.push({
          page: { ...page },
          index,
        })
      }
    })

    // 2. Perform Hard Delete in Store
    this.store.deletePages(this.pageIds)
  }

  undo(): void {
    // 3. Restore in correct order (Ascending Index)
    // If we insert index 5, then index 10, the relative order is preserved
    // provided we sort by index ascending.
    const sorted = [...this.deletedPages].sort((a, b) => a.index - b.index)

    for (const { page, index } of sorted) {
      this.store.insertPages(index, [page])
    }
  }
}
