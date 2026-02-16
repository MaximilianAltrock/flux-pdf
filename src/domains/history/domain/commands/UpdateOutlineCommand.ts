import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { OutlineNode } from '@/types'
import { useDocumentStore } from '@/domains/document/store/document.store'

export class UpdateOutlineCommand extends BaseCommand {
  public readonly type = CommandType.UPDATE_OUTLINE
  public readonly name: string

  private readonly previousTree: OutlineNode[]
  private readonly nextTree: OutlineNode[]
  private readonly previousDirty: boolean
  private readonly nextDirty: boolean

  constructor(
    previousTree: OutlineNode[],
    nextTree: OutlineNode[],
    previousDirty: boolean,
    nextDirty: boolean,
    name: string,
    id?: string,
    createdAt?: number,
  ) {
    super(id, createdAt)
    this.previousTree = cloneTree(previousTree ?? [])
    this.nextTree = cloneTree(nextTree ?? [])
    this.previousDirty = previousDirty
    this.nextDirty = nextDirty
    this.name = name
  }

  execute(): void {
    const store = useDocumentStore()
    store.setOutlineTree(this.nextTree, false)
    store.setOutlineDirty(this.nextDirty)
  }

  undo(): void {
    const store = useDocumentStore()
    store.setOutlineTree(this.previousTree, false)
    store.setOutlineDirty(this.previousDirty)
  }

  protected getPayload(): Record<string, unknown> {
    return {
      previousTree: this.previousTree,
      nextTree: this.nextTree,
      previousDirty: this.previousDirty,
      nextDirty: this.nextDirty,
      name: this.name,
    }
  }

  static deserialize(data: SerializedCommand): UpdateOutlineCommand {
    const { id, previousTree, nextTree, previousDirty, nextDirty, name } = data.payload as {
      id: string
      previousTree: OutlineNode[]
      nextTree: OutlineNode[]
      previousDirty: boolean
      nextDirty: boolean
      name: string
    }
    return new UpdateOutlineCommand(
      previousTree,
      nextTree,
      previousDirty,
      nextDirty,
      name,
      id,
      data.timestamp,
    )
  }
}

function cloneTree(nodes: OutlineNode[]): OutlineNode[] {
  return JSON.parse(JSON.stringify(nodes)) as OutlineNode[]
}

registerCommand(CommandType.UPDATE_OUTLINE, UpdateOutlineCommand)

