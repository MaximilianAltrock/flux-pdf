import type {
  ExportOptions,
  ExportResult,
  ExportService,
} from '@/domains/export/application/export-service'
import type { Result } from '@/shared/types/result'

export function exportPdf(
  service: Pick<ExportService, 'exportDocument'>,
  options: ExportOptions,
): Promise<Result<ExportResult>> {
  return service.exportDocument(options)
}
