import type {
  DocumentService,
  ImportOptions,
  ImportSummary,
} from '@/domains/document/application/document.service'
import type { Result } from '@/shared/types/result'

export function importPdf(
  service: Pick<DocumentService, 'importFiles'>,
  files: FileList | File[],
  options: ImportOptions = {},
): Promise<Result<ImportSummary>> {
  return service.importFiles(files, options)
}
