import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import { ROTATION_DELTA_DEGREES, type RotationDelta } from '@/shared/constants'
import { useDocumentStore } from '@/domains/document/store/document.store'

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
  public readonly degrees: RotationDelta

  constructor(pageIds: string[], degrees: RotationDelta, id?: string, createdAt?: number) {
    super(id, createdAt)

    // Validate inputs
    if (!pageIds || pageIds.length === 0) {
      throw new Error('RotatePagesCommand requires at least one page ID')
    }
    if (degrees !== ROTATION_DELTA_DEGREES.RIGHT && degrees !== ROTATION_DELTA_DEGREES.LEFT) {
      throw new Error(
        `Rotation degrees must be ${ROTATION_DELTA_DEGREES.RIGHT} or ${ROTATION_DELTA_DEGREES.LEFT}`,
      )
    }

    // TODO: Move defensive copying to store layer
    this.pageIds = [...pageIds]
    this.degrees = degrees

    const direction = degrees > 0 ? 'right' : 'left'
    this.name =
      pageIds.length === 1
        ? `Rotate ${direction} page`
        : `Rotate ${direction} ${pageIds.length} pages`
  }

  execute(): void {
    const store = useDocumentStore()
    for (const pageId of this.pageIds) {
      store.rotatePage(pageId, this.degrees)
    }
  }

  undo(): void {
    const store = useDocumentStore()
    const reverseDegrees =
      this.degrees === ROTATION_DELTA_DEGREES.RIGHT
        ? ROTATION_DELTA_DEGREES.LEFT
        : ROTATION_DELTA_DEGREES.RIGHT
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

  static deserialize(data: SerializedCommand): RotatePagesCommand {
    const { id, pageIds, degrees } = data.payload as {
      id: string
      pageIds: string[]
      degrees: RotationDelta
    }
    return new RotatePagesCommand(pageIds, degrees, id, data.timestamp)
  }
}

registerCommand(CommandType.ROTATE, RotatePagesCommand)

