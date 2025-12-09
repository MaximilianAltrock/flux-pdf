import { usePdfManager } from './usePdfManager'
import { useCommandManager } from './useCommandManager'
import { useToast } from './useToast'
import { AddPagesCommand } from '@/commands'

export function useFileHandler() {
  const pdfManager = usePdfManager()
  const { execute } = useCommandManager()
  const toast = useToast()

  async function handleFiles(fileList: FileList | File[]) {
    // 1. Load Blobs into Memory
    const results = await pdfManager.loadPdfFiles(fileList)

    const successes = results.filter((r) => r.success)
    const errors = results.filter((r) => !r.success)

    // 2. Command Execution
    if (successes.length > 0) {
      for (const result of successes) {
        if (result.sourceFile && result.pageRefs) {
          execute(new AddPagesCommand(result.sourceFile, result.pageRefs, true))
        }
      }

      const totalPages = successes.reduce((sum, r) => sum + (r.sourceFile?.pageCount ?? 0), 0)

      toast.success(
        `Added ${successes.length} file${successes.length > 1 ? 's' : ''}`,
        `${totalPages} page${totalPages > 1 ? 's' : ''} added`,
      )
    }

    // 3. Error Handling
    if (errors.length > 0) {
      toast.error(
        `Failed to load ${errors.length} file${errors.length > 1 ? 's' : ''}`,
        errors.map((e) => e.error).join(', '),
      )
    }
  }

  return { handleFiles }
}
