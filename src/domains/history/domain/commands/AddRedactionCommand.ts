import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { RedactionMark } from '@/shared/types'
import { cloneRedactionMark } from '@/shared/utils/document-clone'

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
    this.redactions = redactions.map(cloneRedactionMark)
    this.name =
      this.redactions.length === 1 ? 'Add redaction' : `Add ${this.redactions.length} redactions`
  }

  protected getPayload(): Record<string, unknown> {
    return {
      pageId: this.pageId,
      redactions: this.redactions.map(cloneRedactionMark),
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

