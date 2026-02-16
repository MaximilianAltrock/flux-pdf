import { AddSourceCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { SourceFile } from '@/shared/types'

export function addSource(
  history: HistoryCommandExecutor,
  sourceFile: SourceFile,
): AddSourceCommand {
  return executeCommand(history, new AddSourceCommand(sourceFile))
}
