import { UpdateOutlineCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { OutlineNode } from '@/shared/types'

export interface UpdateOutlineTreeInput {
  previousTree: OutlineNode[]
  nextTree: OutlineNode[]
  previousDirty: boolean
  nextDirty?: boolean
  name?: string
}

export function updateOutlineTree(
  history: HistoryCommandExecutor,
  input: UpdateOutlineTreeInput,
): UpdateOutlineCommand {
  const name = input.name ?? 'Update outline'
  const nextDirty = input.nextDirty ?? true
  return executeCommand(
    history,
    new UpdateOutlineCommand(
      input.previousTree,
      input.nextTree,
      input.previousDirty,
      nextDirty,
      name,
    ),
  )
}
