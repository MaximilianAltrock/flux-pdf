import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'

/**
 * Command to duplicate pages
 */
export class DuplicatePagesCommand implements Command {
  readonly id = crypto.randomUUID()
  readonly name: string

  private store = useDocumentStore()
  private pageIds: string[]
  private duplicatedPages: PageReference[] = []
  private insertIndices: number[] = []

  constructor(pageIds: string[]) {
    this.pageIds = pageIds
    const count = pageIds.length
    this.name = count === 1 ? 'Duplicate page' : `Duplicate ${count} pages`
  }

  execute(): void {
    // Find pages to duplicate and their indices
    const pagesToDuplicate: { page: PageReference; index: number }[] = []

    for (const id of this.pageIds) {
      const index = this.store.pages.findIndex((p) => p.id === id)
      if (index !== -1 && this.store.pages[index]) {
        pagesToDuplicate.push({ page: this.store.pages[index], index })
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
        rotation: page.rotation,
      }

      // Insert after the original using store action
      const insertIndex = index + 1
      this.store.insertPages(insertIndex, [duplicate])

      this.duplicatedPages.push(duplicate)
      this.insertIndices.push(insertIndex)
    }

    // Reverse arrays so they're in the order they were added
    this.duplicatedPages.reverse()
    this.insertIndices.reverse()
  }
  undo(): void {
    // Remove the duplicated pages
    const idsToRemove: string[] = []
    for (let i = this.duplicatedPages.length - 1; i >= 0; i--) {
      const duplicate = this.duplicatedPages[i]
      if (!duplicate) continue
      idsToRemove.push(duplicate.id)
    }
    this.store.deletePages(idsToRemove)
  }
}
