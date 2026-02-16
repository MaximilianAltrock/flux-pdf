import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import { useDocumentStore } from '@/domains/document/store/document.store'

export type ResizeTarget = {
  pageId: string
  targetDimensions?: { width: number; height: number } | null
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

    // TODO: Move defensive copying to store layer
    this.targets = targets.map((t) => ({
      pageId: t.pageId,
      targetDimensions: t.targetDimensions
        ? { ...t.targetDimensions }
        : (t.targetDimensions ?? null),
    }))

    if (previousTargets) {
      // TODO: Move defensive copying to store layer
      this.previousTargets = previousTargets.map((t) => ({
        pageId: t.pageId,
        targetDimensions: t.targetDimensions
          ? { ...t.targetDimensions }
          : (t.targetDimensions ?? null),
      }))
    }

    this.name = this.targets.length === 1 ? 'Resize page' : `Resize ${this.targets.length} pages`
  }

  execute(): void {
    const store = useDocumentStore()

    if (this.previousTargets.length === 0) {
      this.previousTargets = this.targets.map((target) => {
        const page = store.pages.find((p) => !p.isDivider && p.id === target.pageId)
        return {
          pageId: target.pageId,
          targetDimensions:
            page && !page.isDivider && page.targetDimensions ? { ...page.targetDimensions } : null,
        }
      })
    }

    for (const target of this.targets) {
      store.setPageTargetDimensions(target.pageId, target.targetDimensions ?? null)
    }
  }

  undo(): void {
    const store = useDocumentStore()

    for (const previous of this.previousTargets) {
      store.setPageTargetDimensions(previous.pageId, previous.targetDimensions ?? null)
    }
  }

  protected getPayload(): Record<string, unknown> {
    return {
      targets: this.targets,
      previousTargets: this.previousTargets,
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

