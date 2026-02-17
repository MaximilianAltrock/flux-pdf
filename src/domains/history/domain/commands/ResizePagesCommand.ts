import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'

export type ResizeTarget = {
  pageId: string
  targetDimensions?: { width: number; height: number } | null
}

export class ResizePagesCommand extends BaseCommand {
  public readonly type = CommandType.RESIZE
  public readonly name: string

  public readonly targets: ResizeTarget[]
  public previousTargets: ResizeTarget[] = []

  constructor(
    targets: ResizeTarget[],
    id?: string,
    previousTargets?: ResizeTarget[],
    createdAt?: number,
  ) {
    super(id, createdAt)

    if (!targets || targets.length === 0) {
      throw new Error('ResizePagesCommand requires at least one target')
    }

    this.targets = cloneResizeTargets(targets)

    if (previousTargets) {
      this.previousTargets = cloneResizeTargets(previousTargets)
    }

    this.name = this.targets.length === 1 ? 'Resize page' : `Resize ${this.targets.length} pages`
  }

  protected getPayload(): Record<string, unknown> {
    return {
      targets: cloneResizeTargets(this.targets),
      previousTargets: cloneResizeTargets(this.previousTargets),
    }
  }

  static deserialize(data: SerializedCommand): ResizePagesCommand {
    const { id, targets, previousTargets } = data.payload as {
      id: string
      targets: ResizeTarget[]
      previousTargets: ResizeTarget[]
    }
    return new ResizePagesCommand(targets, id, previousTargets, data.timestamp)
  }
}

registerCommand(CommandType.RESIZE, ResizePagesCommand)

function cloneResizeTarget(target: ResizeTarget): ResizeTarget {
  return {
    pageId: target.pageId,
    targetDimensions: target.targetDimensions ? { ...target.targetDimensions } : (target.targetDimensions ?? null),
  }
}

function cloneResizeTargets(targets: ReadonlyArray<ResizeTarget>): ResizeTarget[] {
  return targets.map(cloneResizeTarget)
}

