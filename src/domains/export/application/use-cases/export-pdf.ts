import type {
  ExportOptions,
  ExportResult,
  ProjectSessionServices,
} from '@/domains/project-session/application/create-project-session-services'
import type { ExportService } from '@/domains/export/application/export-service'
import type { Result } from '@/shared/types/result'

export function exportPdf(
  service: Pick<ProjectSessionServices, 'exportDocument'> | ExportService,
  options: ExportOptions,
): Promise<Result<ExportResult>> {
  return service.exportDocument(options)
}
