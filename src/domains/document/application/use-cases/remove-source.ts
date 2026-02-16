import { RemoveSourceCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { PageEntry, SourceFile } from '@/shared/types'

export function removeSource(
  history: HistoryCommandExecutor,
  sourceFile: SourceFile,
  pages: PageEntry[],
): RemoveSourceCommand {
  return executeCommand(history, new RemoveSourceCommand(sourceFile, pages))
}
