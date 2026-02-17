import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { RedactionMark } from '@/shared/types'
import { cloneRedactionMark } from '@/shared/utils/document-clone'

export class DeleteRedactionCommand extends BaseCommand {
  public readonly type = CommandType.DELETE_REDACTION
  public readonly name = 'Delete redaction'

  public readonly pageId: string
  public readonly redaction: RedactionMark

  constructor(pageId: string, redaction: RedactionMark, id?: string, createdAt?: number) {
    super(id, createdAt)

    if (!pageId) {
      throw new Error('DeleteRedactionCommand requires a page ID')
    }
    if (!redaction?.id) {
      throw new Error('DeleteRedactionCommand requires a redaction')
    }

    this.pageId = pageId
    this.redaction = cloneRedactionMark(redaction)
  }

  protected getPayload(): Record<string, unknown> {
    return {
      pageId: this.pageId,
      redaction: cloneRedactionMark(this.redaction),
    }
  }

  static deserialize(data: SerializedCommand): DeleteRedactionCommand {
    const { id, pageId, redaction } = data.payload as {
      id: string
      pageId: string
      redaction: RedactionMark
    }
    return new DeleteRedactionCommand(pageId, redaction, id, data.timestamp)
  }
}

registerCommand(CommandType.DELETE_REDACTION, DeleteRedactionCommand)

