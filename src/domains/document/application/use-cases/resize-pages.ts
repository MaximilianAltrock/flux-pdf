import { ResizePagesCommand, type ResizeTarget } from '@/domains/history/domain/commands/ResizePagesCommand'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'

export function resizePages(
  history: HistoryCommandExecutor,
  targets: ResizeTarget[],
): ResizePagesCommand {
  return executeCommand(history, new ResizePagesCommand(targets))
}
