import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { RedactionMark } from '@/types'
import { useDocumentStore } from '@/domains/document/store/document.store'

export class UpdateRedactionCommand extends BaseCommand {
  public readonly type = CommandType.UPDATE_REDACTION
  public readonly name = 'Update redaction'

  public readonly pageId: string
  public readonly previous: RedactionMark
  public readonly next: RedactionMark

  constructor(
    pageId: string,
    previous: RedactionMark,
    next: RedactionMark,
    id?: string,
    createdAt?: number,
  ) {
    super(id, createdAt)

    if (!pageId) {
      throw new Error('UpdateRedactionCommand requires a page ID')
    }
    if (!previous?.id || !next?.id) {
      throw new Error('UpdateRedactionCommand requires valid redactions')
    }

    this.pageId = pageId
    this.previous = { ...previous }
    this.next = { ...next }
  }

  execute(): void {
    const store = useDocumentStore()
    store.updateRedaction(this.pageId, this.next)
  }

  undo(): void {
    const store = useDocumentStore()
    store.updateRedaction(this.pageId, this.previous)
  }

  protected getPayload(): Record<string, unknown> {
    return {
      pageId: this.pageId,
      previous: this.previous,
      next: this.next,
    }
  }

  static deserialize(data: SerializedCommand): UpdateRedactionCommand {
    const { id, pageId, previous, next } = data.payload as {
      id: string
      pageId: string
      previous: RedactionMark
      next: RedactionMark
    }
    return new UpdateRedactionCommand(pageId, previous, next, id, data.timestamp)
  }
}

registerCommand(CommandType.UPDATE_REDACTION, UpdateRedactionCommand)

