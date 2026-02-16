import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { DividerReference } from '@/types'
import { useDocumentStore } from '@/domains/document/store/document.store'

/**
 * Command to split the document at a specific position
 *
 * Inserts a virtual "divider" page that marks a document boundary.
 * When exporting, these dividers split the output into multiple PDFs.
 */
export class SplitGroupCommand extends BaseCommand {
  public readonly type = CommandType.SPLIT
  public readonly name = 'Split document'

  /** Index where the divider should be inserted */
  public readonly index: number

  /** The divider page reference (virtual, not a real PDF page) */
  public readonly divider: DividerReference

  constructor(index: number, id?: string, existingDivider?: DividerReference, createdAt?: number) {
    super(id, createdAt)

    // Validate inputs
    if (typeof index !== 'number' || index < 0) {
      throw new Error('SplitGroupCommand requires a valid index')
    }

    this.index = index

    // Use existing divider (from deserialization) or create new one
    this.divider = existingDivider ?? this.createDivider()
  }

  /**
   * Create a new virtual divider page reference
   */
  private createDivider(): DividerReference {
    return {
      id: crypto.randomUUID(),
      isDivider: true,
    }
  }

  execute(): void {
    const store = useDocumentStore()
    // TODO: Move defensive copying to store layer
    store.insertPages(this.index, [{ ...this.divider }])
  }

  undo(): void {
    const store = useDocumentStore()
    store.deletePages([this.divider.id])
  }

  protected getPayload(): Record<string, unknown> {
    return {
      index: this.index,
      // TODO: Move defensive copying to store layer
      divider: { ...this.divider },
    }
  }

  static deserialize(data: SerializedCommand): SplitGroupCommand {
    const { id, index, divider } = data.payload as {
      id: string
      index: number
      divider: DividerReference
    }
    return new SplitGroupCommand(index, id, divider, data.timestamp)
  }
}

registerCommand(CommandType.SPLIT, SplitGroupCommand)

