import type { Command } from './types'
import type { PageReference, SourceFile } from '@/types'
import { useDocumentStore } from '@/stores/document'
import { CommandType } from './registry'

export class AddPagesCommand implements Command {
  public readonly type = CommandType.ADD
  public readonly id: string
  public readonly name: string

  // Public for JSON serialization
  public sourceFile: SourceFile
  public pages: PageReference[]
  public shouldAddSource: boolean

  constructor(sourceFile: SourceFile, pages: PageReference[], shouldAddSource = true) {
    this.id = crypto.randomUUID()
    this.sourceFile = { ...sourceFile }
    // Deep copy pages to ensure isolation
    this.pages = pages.map((p) => ({ ...p }))
    this.name = `Add "${sourceFile.filename}"`
    this.shouldAddSource = shouldAddSource
  }

  execute(): void {
    const store = useDocumentStore()

    // 1. Add Source Metadata if needed
    if (this.shouldAddSource && !store.sources.has(this.sourceFile.id)) {
      store.addSourceFile(this.sourceFile)
    }

    // 2. Add Pages to Grid
    store.addPages(this.pages.map((p) => ({ ...p })))
  }

  undo(): void {
    const store = useDocumentStore()

    // 1. Remove Pages
    const pageIds = this.pages.map((p) => p.id)
    store.deletePages(pageIds)

    // 2. Remove Source (only if this command added it)
    if (this.shouldAddSource) {
      store.removeSourceOnly(this.sourceFile.id)
    }
  }
}
