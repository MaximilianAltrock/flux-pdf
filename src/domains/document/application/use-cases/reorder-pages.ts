import { ReorderPagesCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { PageEntry } from '@/types'

export function reorderPages(
  history: HistoryCommandExecutor,
  previousOrder: PageEntry[],
  nextOrder: PageEntry[],
): ReorderPagesCommand {
  return executeCommand(history, new ReorderPagesCommand(previousOrder, nextOrder))
}
