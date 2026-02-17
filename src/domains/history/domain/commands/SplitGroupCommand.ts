import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { DividerReference } from '@/shared/types'
import { cloneDividerReference } from '@/shared/utils/document-clone'

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
    this.divider = existingDivider ? cloneDividerReference(existingDivider) : this.createDivider()
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

  protected getPayload(): Record<string, unknown> {
    return {
      index: this.index,
      divider: cloneDividerReference(this.divider),
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

