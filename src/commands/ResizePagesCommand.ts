import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import { useDocumentStore } from '@/stores/document'

export type ResizeTarget = {
  pageId: string
  targetDimensions?: { width: number; height: number } | null
}

interface ResizePagesPayload {
  id: string
  targets: ResizeTarget[]
  previousTargets: ResizeTarget[]
}

export class ResizePagesCommand extends BaseCommand {
  public readonly type = CommandType.RESIZE
  public readonly name: string

  public readonly targets: ResizeTarget[]
  private previousTargets: ResizeTarget[] = []

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

    this.targets = targets.map((t) => ({
      pageId: t.pageId,
      targetDimensions: t.targetDimensions ? { ...t.targetDimensions } : t.targetDimensions ?? null,
    }))

    if (previousTargets) {
      this.previousTargets = previousTargets.map((t) => ({
        pageId: t.pageId,
        targetDimensions: t.targetDimensions ? { ...t.targetDimensions } : t.targetDimensions ?? null,
      }))
    }

    this.name = BaseCommand.formatName('Resize', this.targets.length)
  }

  execute(): void {
    const store = useDocumentStore()

    if (this.previousTargets.length === 0) {
      this.previousTargets = this.targets.map((target) => {
        const page = store.pages.find((p) => !p.isDivider && p.id === target.pageId)
        return {
          pageId: target.pageId,
          targetDimensions: page && !page.isDivider && page.targetDimensions
            ? { ...page.targetDimensions }
            : null,
        }
      })
    }

    for (const target of this.targets) {
      const page = store.pages.find((p) => !p.isDivider && p.id === target.pageId)
      if (!page || page.isDivider) continue
      if (target.targetDimensions) {
        page.targetDimensions = { ...target.targetDimensions }
      } else {
        page.targetDimensions = undefined
      }
    }
  }

  undo(): void {
    const store = useDocumentStore()

    for (const previous of this.previousTargets) {
      const page = store.pages.find((p) => !p.isDivider && p.id === previous.pageId)
      if (!page || page.isDivider) continue
      if (previous.targetDimensions) {
        page.targetDimensions = { ...previous.targetDimensions }
      } else {
        page.targetDimensions = undefined
      }
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      targets: this.targets,
      previousTargets: this.previousTargets,
    }
  }

  static deserialize(data: SerializedCommand): ResizePagesCommand {
    const payload = data.payload as unknown as ResizePagesPayload
    return new ResizePagesCommand(
      payload.targets,
      payload.id,
      payload.previousTargets,
      data.timestamp,
    )
  }
}

registerCommand(CommandType.RESIZE, ResizePagesCommand)
