import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { PageReference, SourceFile } from '@/shared/types'
import { clonePageReferences, cloneSourceFile } from '@/shared/utils/document-clone'

/**
 * Command to add pages from a source file
 *
 * Optionally adds the source file metadata to the store.
 * On undo, removes both the pages and the source (if added).
 */
export class AddPagesCommand extends BaseCommand {
  public readonly type = CommandType.ADD
  public readonly name: string

  /** Metadata about the source PDF file */
  public readonly sourceFile: SourceFile

  /** Page references to add */
  public readonly pages: PageReference[]

  /** Whether this command should add the source file (vs it already existing) */
  public readonly shouldAddSource: boolean

  constructor(
    sourceFile: SourceFile,
    pages: PageReference[],
    shouldAddSource = true,
    id?: string,
    createdAt?: number,
  ) {
    super(id, createdAt)

    // Validate inputs
    if (!sourceFile || !sourceFile.id) {
      throw new Error('AddPagesCommand requires a valid sourceFile')
    }
    if (!pages || pages.length === 0) {
      throw new Error('AddPagesCommand requires at least one page')
    }

    this.sourceFile = cloneSourceFile(sourceFile)
    this.pages = clonePageReferences(pages)
    this.shouldAddSource = shouldAddSource

    this.name = shouldAddSource
      ? `Import "${sourceFile.filename}"`
      : `Add pages from "${sourceFile.filename}"`
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourceFile: cloneSourceFile(this.sourceFile),
      pages: clonePageReferences(this.pages),
      shouldAddSource: this.shouldAddSource,
    }
  }

  static deserialize(data: SerializedCommand): AddPagesCommand {
    const { id, sourceFile, pages, shouldAddSource } = data.payload as {
      id: string
      sourceFile: SourceFile
      pages: PageReference[]
      shouldAddSource: boolean
    }
    return new AddPagesCommand(sourceFile, pages, shouldAddSource, id, data.timestamp)
  }
}

registerCommand(CommandType.ADD, AddPagesCommand)

