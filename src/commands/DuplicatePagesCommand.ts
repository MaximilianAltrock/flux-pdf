import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'
import { CommandType } from './registry'

export class DuplicatePagesCommand implements Command {
  public readonly type = CommandType.DUPLICATE
  public readonly id: string
  public readonly name: string

  public sourcePageIds: string[]

  // Track the IDs of the clones we created so we can delete them on undo
  public createdPageIds: string[] = []

  constructor(pageIds: string[]) {
    this.id = crypto.randomUUID()
    this.sourcePageIds = [...pageIds]
    const count = pageIds.length
    this.name = count === 1 ? 'Duplicate page' : `Duplicate ${count} pages`
  }

  execute(): void {
    const store = useDocumentStore()

    // If we already have created IDs (Redo scenario), we might need to clear them
    // But typically Redo logic just re-runs logic.
    // For idempotency in "Redo", we reset the tracking array if we are re-generating.
    // However, to keep IDs consistent across Undo/Redo/Persistence,
    // we should ideally reuse IDs if they exist.
    const reuseExistingIds = this.createdPageIds.length > 0

    if (!reuseExistingIds) {
      this.createdPageIds = []
    }

    const pagesToDuplicate: { page: PageReference; index: number }[] = []

    for (const id of this.sourcePageIds) {
      const index = store.pages.findIndex((p) => p.id === id)
      if (index !== -1 && store.pages[index]) {
        pagesToDuplicate.push({ page: store.pages[index], index })
      }
    }

    // Sort descending to insert from end to start (maintains indices)
    pagesToDuplicate.sort((a, b) => b.index - a.index)

    // Used for reconstruction during loop
    const tempCreatedIds: string[] = []

    // Execute duplication
    let reuseIndex = 0 // For iterating createdPageIds if reusing

    for (const { page, index } of pagesToDuplicate) {
      // If reusing (Redo), use the ID we generated last time.
      // If new (First Run), generate new ID.
      const newId = reuseExistingIds
        ? this.createdPageIds[this.createdPageIds.length - 1 - reuseIndex]!
        : crypto.randomUUID()

      const duplicate: PageReference = {
        id: newId,
        sourceFileId: page.sourceFileId,
        sourcePageIndex: page.sourcePageIndex,
        rotation: page.rotation,
        groupId: page.groupId,
      }

      store.insertPages(index + 1, [duplicate])

      if (!reuseExistingIds) {
        tempCreatedIds.push(newId)
      }
      reuseIndex++
    }

    if (!reuseExistingIds) {
      // Reverse to match the visual order (if we care about array consistency)
      this.createdPageIds = tempCreatedIds.reverse()
    }
  }

  undo(): void {
    const store = useDocumentStore()
    // Simply delete the pages we created
    store.deletePages(this.createdPageIds)
  }
}
