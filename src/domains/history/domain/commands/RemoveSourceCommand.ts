import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand, PageSnapshot } from './types'
import type { SourceFile, PageEntry, PageReference } from '@/shared/types'
import { clonePageReference, cloneSourceFile } from '@/shared/utils/document-clone'

/**
 * Command to remove a source file and all of its pages.
 *
 * Note: This only mutates in-memory store state. Persisted blobs are
 * removed separately during storage GC.
 */
export class RemoveSourceCommand extends BaseCommand {
  public readonly type = CommandType.REMOVE_SOURCE
  public readonly name: string

  public readonly sourceFile: SourceFile
  public readonly pageSnapshots: PageSnapshot[]

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

    this.sourceFile = cloneSourceFile(sourceFile)
    this.name = `Remove "${sourceFile.filename}"`

    // Capture positions of pages belonging to this source for undo
    if (existingSnapshots && existingSnapshots.length > 0) {
      this.pageSnapshots = existingSnapshots.map((s) => ({
        page: clonePageReference(s.page),
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
          page: clonePageReference(page),
          index,
        }))
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourceFile: cloneSourceFile(this.sourceFile),
      pageSnapshots: this.pageSnapshots.map((snapshot) => ({
        page: clonePageReference(snapshot.page),
        index: snapshot.index,
      })),
    }
  }

  static deserialize(data: SerializedCommand): RemoveSourceCommand {
    const { id, sourceFile, pageSnapshots } = data.payload as {
      id: string
      sourceFile: SourceFile
      pageSnapshots: PageSnapshot[]
    }
    // We pass empty array [] for pages because we are providing existingSnapshots
    return new RemoveSourceCommand(sourceFile, [], id, data.timestamp, pageSnapshots)
  }
}

registerCommand(CommandType.REMOVE_SOURCE, RemoveSourceCommand)

