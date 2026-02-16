import type {
  DocumentService,
  ExportOptions,
  ExportResult,
} from '@/domains/document/application/document.service'
import type { Result } from '@/types/result'

export function exportPdf(
  service: Pick<DocumentService, 'exportDocument'>,
  options: ExportOptions,
): Promise<Result<ExportResult>> {
  return service.exportDocument(options)
}
