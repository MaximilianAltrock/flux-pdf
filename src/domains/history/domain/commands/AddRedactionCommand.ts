import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { RedactionMark } from '@/types'
import { useDocumentStore } from '@/domains/document/store/document.store'

export class AddRedactionCommand extends BaseCommand {
  public readonly type = CommandType.REDACT
  public readonly name: string

  public readonly pageId: string
  public readonly redactions: RedactionMark[]

  constructor(pageId: string, redactions: RedactionMark[], id?: string, createdAt?: number) {
    super(id, createdAt)

    if (!pageId) {
      throw new Error('AddRedactionCommand requires a page ID')
    }
    if (!redactions || redactions.length === 0) {
      throw new Error('AddRedactionCommand requires at least one redaction')
    }

    this.pageId = pageId
    this.redactions = redactions.map((r) => ({ ...r }))
    this.name =
      this.redactions.length === 1 ? 'Add redaction' : `Add ${this.redactions.length} redactions`
  }

  execute(): void {
    const store = useDocumentStore()
    store.addRedactions(this.pageId, this.redactions)
  }

  undo(): void {
    const store = useDocumentStore()
    store.removeRedactions(
      this.pageId,
      this.redactions.map((r) => r.id),
    )
  }

  protected getPayload(): Record<string, unknown> {
    return {
      pageId: this.pageId,
      redactions: this.redactions,
    }
  }

  static deserialize(data: SerializedCommand): AddRedactionCommand {
    const { id, pageId, redactions } = data.payload as {
      id: string
      pageId: string
      redactions: RedactionMark[]
    }

    return new AddRedactionCommand(pageId, redactions, id, data.timestamp)
  }
}

registerCommand(CommandType.REDACT, AddRedactionCommand)

