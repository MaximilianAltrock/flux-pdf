import type {
  ImportOptions,
  ImportService,
  ImportSummary,
} from '@/domains/import/application/import-service'
import type { Result } from '@/shared/types/result'

export function importPdf(
  service: Pick<ImportService, 'importFiles'>,
  files: FileList | File[],
  options: ImportOptions = {},
): Promise<Result<ImportSummary>> {
  return service.importFiles(files, options)
}
