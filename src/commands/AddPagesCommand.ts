import type { Command } from './types'
import type { PageReference, SourceFile } from '@/types'
import { useDocumentStore } from '@/stores/document'

/**
 * Command to add pages from a newly loaded PDF
 */
export class AddPagesCommand implements Command {
  readonly id: string
  readonly name: string

  private sourceFile: SourceFile
  private pages: PageReference[]
  private store = useDocumentStore()
  private shouldAddSource: boolean

  constructor(sourceFile: SourceFile, pages: PageReference[], shouldAddSource = true) {
    this.id = crypto.randomUUID()
    this.sourceFile = { ...sourceFile }
    this.pages = pages.map(p => ({ ...p }))
    this.name = `Add "${sourceFile.filename}"`
    this.shouldAddSource = shouldAddSource
  }

  execute(): void {
    if (this.shouldAddSource && !this.store.sources.has(this.sourceFile.id)) {
      this.store.addSourceFile(this.sourceFile)
    }
    this.store.addPages(this.pages.map(p => ({ ...p })))
  }

  undo(): void {
    // Remove the pages
    const pageIds = this.pages.map(p => p.id)
    this.store.removePages(pageIds)

    // Remove source only if we added it (use removeSourceOnly to avoid double page removal)
    if (this.shouldAddSource) {
      this.store.removeSourceOnly(this.sourceFile.id)
    }
  }
}
