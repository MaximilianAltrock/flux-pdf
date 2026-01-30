import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'

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
  private createdPageIds: string[] = []

  constructor(sourcePageIds: string[], id?: string, createdPageIds?: string[], createdAt?: number) {
    super(id, createdAt)

    // Validate inputs
    if (!sourcePageIds || sourcePageIds.length === 0) {
      throw new Error('DuplicatePagesCommand requires at least one source page ID')
    }

    // TODO: Move defensive copying to store layer
    this.sourcePageIds = [...sourcePageIds]
    this.name =
      sourcePageIds.length === 1 ? 'Duplicate page' : `Duplicate ${sourcePageIds.length} pages`

    // Restore created IDs if provided (from deserialization)
    if (createdPageIds) {
      this.createdPageIds = [...createdPageIds]
    }
  }

  execute(): void {
    const store = useDocumentStore()
    const isRedo = this.createdPageIds.length > 0

    // Find pages to duplicate with their indices
    const pagesToDuplicate: { page: PageReference; index: number }[] = []

    for (const sourceId of this.sourcePageIds) {
      const index = store.pages.findIndex((p) => p.id === sourceId)
      if (index !== -1) {
        const page = store.pages[index]
        if (page && !page.isDivider) {
          pagesToDuplicate.push({
            page,
            index,
          })
        }
      }
    }

    // Sort descending by index to insert from end to start
    // This prevents index shifting during insertion
    pagesToDuplicate.sort((a, b) => b.index - a.index)

    const newIds: string[] = []
    let reuseIndex = 0

    for (const { page, index } of pagesToDuplicate) {
      // On redo, reuse the same IDs we created before
      // This ensures history references remain valid
      const newId = isRedo
        ? this.createdPageIds[this.createdPageIds.length - 1 - reuseIndex]!
        : crypto.randomUUID()

      // TODO: Move defensive copying to store layer
      const duplicate: PageReference = {
        id: newId,
        sourceFileId: page.sourceFileId,
        sourcePageIndex: page.sourcePageIndex,
        rotation: page.rotation,
        width: page.width,
        height: page.height,
        targetDimensions: page.targetDimensions ? { ...page.targetDimensions } : undefined,
        redactions: page.redactions ? page.redactions.map((r) => ({ ...r })) : undefined,
        groupId: page.groupId,
      }

      // Insert duplicate immediately after original
      store.insertPages(index + 1, [duplicate])

      if (!isRedo) {
        newIds.push(newId)
      }
      reuseIndex++
    }

    // Store created IDs in reverse order (to match insertion order)
    if (!isRedo) {
      this.createdPageIds = newIds.reverse()
    }
  }

  undo(): void {
    const store = useDocumentStore()
    store.deletePages(this.createdPageIds)
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourcePageIds: this.sourcePageIds,
      createdPageIds: this.createdPageIds,
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
