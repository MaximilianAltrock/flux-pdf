import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { PageReference, SourceFile } from '@/types'
import { useDocumentStore } from '@/stores/document'

/**
 * Payload structure for serialization
 */
interface AddPagesPayload {
  id: string
  sourceFile: SourceFile
  pages: PageReference[]
  shouldAddSource: boolean
}

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

    // Deep copy to ensure isolation
    this.sourceFile = { ...sourceFile }
    this.pages = BaseCommand.clonePages(pages)
    this.shouldAddSource = shouldAddSource

    this.name = shouldAddSource
      ? `Import "${sourceFile.filename}"`
      : `Add pages from "${sourceFile.filename}"`
  }

  execute(): void {
    const store = useDocumentStore()

    // Add source metadata if needed and not already present
    if (this.shouldAddSource && !store.sources.has(this.sourceFile.id)) {
      store.addSourceFile({ ...this.sourceFile })
    }

    // Add pages to the grid
    store.addPages(BaseCommand.clonePages(this.pages))
  }

  undo(): void {
    const store = useDocumentStore()

    // Remove pages
    const pageIds = this.pages.map((p) => p.id)
    store.deletePages(pageIds)

    // Remove source file only if this command added it
    if (this.shouldAddSource) {
      store.removeSourceOnly(this.sourceFile.id)
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourceFile: this.sourceFile,
      pages: this.pages,
      shouldAddSource: this.shouldAddSource,
    }
  }

  /**
   * Reconstruct command from serialized data
   */
  static deserialize(data: SerializedCommand): AddPagesCommand {
    const payload = data.payload as unknown as AddPagesPayload
    return new AddPagesCommand(
      payload.sourceFile,
      payload.pages,
      payload.shouldAddSource,
      payload.id,
      data.timestamp,
    )
  }
}

// Self-register with the command registry
registerCommand(CommandType.ADD, AddPagesCommand)
