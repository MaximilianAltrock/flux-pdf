import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand, PageSnapshot } from './types'
import type { SourceFile, PageEntry, PageReference } from '@/types'
import { useDocumentStore } from '@/stores/document'

interface RemoveSourcePayload {
  id: string
  sourceFile: SourceFile
  pageSnapshots: PageSnapshot[]
}

/**
 * Command to remove a source file and all of its pages.
 *
 * Note: This only mutates in-memory store state. Persisted blobs are
 * removed separately (e.g., via usePdfManager).
 */
export class RemoveSourceCommand extends BaseCommand {
  public readonly type = CommandType.REMOVE_SOURCE
  public readonly name: string

  public readonly sourceFile: SourceFile
  private readonly pageSnapshots: PageSnapshot[]

  constructor(
    sourceFile: SourceFile,
    pages: PageEntry[],
    id?: string,
    createdAt?: number,
    existingSnapshots?: PageSnapshot[],
  ) {
    super(id, createdAt)

    if (!sourceFile?.id) {
      throw new Error('RemoveSourceCommand requires a valid source file')
    }

    this.sourceFile = { ...sourceFile }
    this.name = `Remove "${sourceFile.filename}"`

    // Capture positions of pages belonging to this source for undo
    if (existingSnapshots && existingSnapshots.length > 0) {
      this.pageSnapshots = existingSnapshots.map((s) => ({
        page: { ...s.page },
        index: s.index,
      }))
    } else {
      this.pageSnapshots = pages
        .map((page, index) => ({ page, index }))
        .filter(
          (item): item is { page: PageReference; index: number } =>
            !item.page.isDivider && item.page.sourceFileId === sourceFile.id,
        )
        .map(({ page, index }) => ({
          page: { ...page },
          index,
        }))
    }
  }

  execute(): void {
    const store = useDocumentStore()

    const pageIds = this.pageSnapshots.map((p) => p.page.id)
    store.deletePages(pageIds)
    store.removeSourceOnly(this.sourceFile.id)
  }

  undo(): void {
    const store = useDocumentStore()

    // Re-add source metadata if missing
    if (!store.sources.has(this.sourceFile.id)) {
      store.addSourceFile({ ...this.sourceFile })
    }

    // Restore pages at original positions (ascending index)
    const sorted = [...this.pageSnapshots].sort((a, b) => a.index - b.index)
    for (const { page, index } of sorted) {
      store.insertPages(index, [{ ...page }])
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourceFile: this.sourceFile,
      pageSnapshots: this.pageSnapshots,
    }
  }

  static deserialize(data: SerializedCommand): RemoveSourceCommand {
    const payload = data.payload as unknown as RemoveSourcePayload

    // We pass empty array [] for pages because we are providing existingSnapshots
    return new RemoveSourceCommand(
      payload.sourceFile,
      [],
      payload.id,
      data.timestamp,
      payload.pageSnapshots,
    )
  }
}

// Self-register with the command registry
registerCommand(CommandType.REMOVE_SOURCE, RemoveSourceCommand)
