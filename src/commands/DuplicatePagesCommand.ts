import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'

/**
 * Command to duplicate pages
 */
export class DuplicatePagesCommand implements Command {
  readonly id = crypto.randomUUID()
  readonly name = 'Duplicate Pages'

  private pageIds: string[]
  private duplicatedPages: PageReference[] = []
  private insertIndices: number[] = []

  constructor(pageIds: string[]) {
    this.pageIds = pageIds
  }

  execute(): void {
    const store = useDocumentStore()

    // Find pages to duplicate and their indices
    const pagesToDuplicate: { page: PageReference; index: number }[] = []

    for (const id of this.pageIds) {
      const index = store.pages.findIndex(p => p.id === id)
      if (index !== -1 && store.pages[index]) {
        pagesToDuplicate.push({ page: store.pages[index], index })
      }
    }

    // Sort by index descending so we insert from end to start
    // This prevents index shifting issues
    pagesToDuplicate.sort((a, b) => b.index - a.index)

    this.duplicatedPages = []
    this.insertIndices = []

    // Create duplicates and insert after each original
    for (const { page, index } of pagesToDuplicate) {
      const duplicate: PageReference = {
        id: crypto.randomUUID(),
        sourceFileId: page.sourceFileId,
        sourcePageIndex: page.sourcePageIndex,
        rotation: page.rotation
      }

      // Insert after the original
      const insertIndex = index + 1
      store.pages.splice(insertIndex, 0, duplicate)

      this.duplicatedPages.push(duplicate)
      this.insertIndices.push(insertIndex)
    }

    // Reverse arrays so they're in the order they were added
    this.duplicatedPages.reverse()
    this.insertIndices.reverse()
  }

  undo(): void {
    const store = useDocumentStore()

    // Remove the duplicated pages (in reverse order)
    for (let i = this.duplicatedPages.length - 1; i >= 0; i--) {
      const duplicate = this.duplicatedPages[i]
      if (!duplicate) continue
      const index = store.pages.findIndex(p => p.id === duplicate.id)
      if (index !== -1) {
        store.pages.splice(index, 1)
      }
    }
  }
}
