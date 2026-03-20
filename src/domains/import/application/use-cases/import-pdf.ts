import type {
  ImportOptions,
  ImportSummary,
  ProjectSessionServices,
} from '@/domains/project-session/application/create-project-session-services'
import type { ImportService } from '@/domains/import/application/import-service'
import type { Result } from '@/shared/types/result'

export function importPdf(
  service: Pick<ProjectSessionServices, 'importFiles'> | ImportService,
  files: FileList | File[],
  options: ImportOptions = {},
): Promise<Result<ImportSummary>> {
  return service.importFiles(files, options)
}
