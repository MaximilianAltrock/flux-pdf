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

  constructor(sourceFile: SourceFile, pages: PageReference[]) {
    this.id = crypto.randomUUID()
    this.sourceFile = { ...sourceFile }
    this.pages = pages.map(p => ({ ...p }))
    this.name = `Add "${sourceFile.filename}"`
  }

  execute(): void {
    this.store.addSourceFile(this.sourceFile)
    this.store.addPages(this.pages.map(p => ({ ...p })))
  }

  undo(): void {
    // Remove the pages and source file
    const pageIds = this.pages.map(p => p.id)
    this.store.removePages(pageIds)
    this.store.sources.delete(this.sourceFile.id)
  }
}
