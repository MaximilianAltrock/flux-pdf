import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import { useDocumentStore } from '@/stores/document'

/**
 * Payload structure for serialization
 */
interface RotatePagesPayload {
  id: string
  pageIds: string[]
  degrees: 90 | -90
}

/**
 * Command to rotate one or more pages
 *
 * Rotation is applied incrementally (adds to existing rotation)
 * and wraps at 360 degrees.
 */
export class RotatePagesCommand extends BaseCommand {
  public readonly type = CommandType.ROTATE
  public readonly name: string

  /** IDs of pages to rotate */
  public readonly pageIds: string[]

  /** Rotation amount in degrees (positive = clockwise) */
  public readonly degrees: 90 | -90

  constructor(pageIds: string[], degrees: 90 | -90, id?: string, createdAt?: number) {
    super(id, createdAt)

    // Validate inputs
    if (!pageIds || pageIds.length === 0) {
      throw new Error('RotatePagesCommand requires at least one page ID')
    }
    if (degrees !== 90 && degrees !== -90) {
      throw new Error('Rotation degrees must be 90 or -90')
    }

    this.pageIds = [...pageIds] // Defensive copy
    this.degrees = degrees

    const direction = degrees > 0 ? 'right' : 'left'
    this.name = BaseCommand.formatName(`Rotate ${direction}`, pageIds.length)
  }

  execute(): void {
    const store = useDocumentStore()
    for (const pageId of this.pageIds) {
      store.rotatePage(pageId, this.degrees)
    }
  }

  undo(): void {
    const store = useDocumentStore()
    const reverseDegrees = (this.degrees === 90 ? -90 : 90) as 90 | -90
    for (const pageId of this.pageIds) {
      store.rotatePage(pageId, reverseDegrees)
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      pageIds: this.pageIds,
      degrees: this.degrees,
    }
  }

  /**
   * Reconstruct command from serialized data
   */
  static deserialize(data: SerializedCommand): RotatePagesCommand {
    const payload = data.payload as unknown as RotatePagesPayload
    return new RotatePagesCommand(payload.pageIds, payload.degrees, payload.id, data.timestamp)
  }
}

// Self-register with the command registry
registerCommand(CommandType.ROTATE, RotatePagesCommand)
