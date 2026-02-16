import { AddPagesCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { PageReference, SourceFile } from '@/shared/types'

export function addPages(
  history: HistoryCommandExecutor,
  sourceFile: SourceFile,
  pages: PageReference[],
  shouldAddSource = true,
): AddPagesCommand {
  return executeCommand(history, new AddPagesCommand(sourceFile, pages, shouldAddSource))
}
