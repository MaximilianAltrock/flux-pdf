import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'
import { CommandType } from './registry'

export class DuplicatePagesCommand implements Command {
  public readonly type = CommandType.DUPLICATE
  public readonly id: string
  public readonly name: string

  public sourcePageIds: string[]
  public createdPageIds: string[] = []

  // Constructor must match the payload.sourcePageIds structure
  constructor(sourcePageIds: string[]) {
    this.id = crypto.randomUUID()
    this.sourcePageIds = [...sourcePageIds]
    const count = sourcePageIds.length
    this.name = count === 1 ? 'Duplicate page' : `Duplicate ${count} pages`
  }

  execute(): void {
    const store = useDocumentStore()
    const reuseExistingIds = this.createdPageIds.length > 0

    // If this is a fresh run (not a redo), clear any stale IDs
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

    const tempCreatedIds: string[] = []
    let reuseIndex = 0

    for (const { page, index } of pagesToDuplicate) {
      // Logic: In Redo, we MUST reuse the same ID we created before,
      // otherwise history stack pointers get confused.
      const newId = reuseExistingIds
        ? this.createdPageIds[this.createdPageIds.length - 1 - reuseIndex]
        : crypto.randomUUID()

      const duplicate: PageReference = {
        id: newId!, // TS assertion
        sourceFileId: page.sourceFileId,
        sourcePageIndex: page.sourcePageIndex,
        rotation: page.rotation,
        groupId: page.groupId,
      }

      store.insertPages(index + 1, [duplicate])

      if (!reuseExistingIds) {
        tempCreatedIds.push(newId!)
      }
      reuseIndex++
    }

    if (!reuseExistingIds) {
      this.createdPageIds = tempCreatedIds.reverse()
    }
  }

  undo(): void {
    const store = useDocumentStore()
    store.deletePages(this.createdPageIds)
  }
}
