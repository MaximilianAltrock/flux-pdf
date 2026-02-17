import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { OutlineNode } from '@/shared/types'
import { cloneOutlineTree } from '@/shared/utils/document-clone'

export class UpdateOutlineCommand extends BaseCommand {
  public readonly type = CommandType.UPDATE_OUTLINE
  public readonly name: string

  public readonly previousTree: OutlineNode[]
  public readonly nextTree: OutlineNode[]
  public readonly previousDirty: boolean
  public readonly nextDirty: boolean

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
    this.previousTree = cloneOutlineTree(previousTree ?? [])
    this.nextTree = cloneOutlineTree(nextTree ?? [])
    this.previousDirty = previousDirty
    this.nextDirty = nextDirty
    this.name = name
  }

  protected getPayload(): Record<string, unknown> {
    return {
      previousTree: cloneOutlineTree(this.previousTree),
      nextTree: cloneOutlineTree(this.nextTree),
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

registerCommand(CommandType.UPDATE_OUTLINE, UpdateOutlineCommand)

