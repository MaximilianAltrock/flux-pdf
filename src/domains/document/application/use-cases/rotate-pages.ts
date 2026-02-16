import { RotatePagesCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { RotationDelta } from '@/shared/constants'

export function rotatePages(
  history: HistoryCommandExecutor,
  pageIds: string[],
  degrees: RotationDelta,
): RotatePagesCommand {
  return executeCommand(history, new RotatePagesCommand(pageIds, degrees))
}
