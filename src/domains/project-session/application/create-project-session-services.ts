import { usePdfRepository } from '@/shared/infrastructure/pdf.repository'
import { createDocumentImportService } from '@/domains/import/application/document-import.service'
import { createDocumentExportService } from '@/domains/export/application/document-export.service'
import type {
  ImportServiceDeps,
  ImportOptions,
  ImportSummary,
} from '@/domains/import/application/import-service'
import type {
  ExportServiceDeps,
  ExportOptions,
  ExportResult,
  GeneratorOptions,
  ExportCompressionBindings,
  ExportUiBindings,
  ExportServiceSettings,
} from '@/domains/export/application/export-service'
import type { ImportUiBindings, ImportServiceSettings } from '@/domains/import/application/import-service'
import type { PdfRepository } from '@/shared/infrastructure/pdf.repository'

export function createProjectSessionServices(
  deps: Omit<ImportServiceDeps, 'ui' | 'settings'> & {
    ui?: ImportUiBindings & ExportUiBindings
    settings: ImportServiceSettings & ExportServiceSettings
    compression?: ExportCompressionBindings
  },
) {
  const pdfRepository = usePdfRepository()

  const importDeps: ImportServiceDeps = {
    documentStore: deps.documentStore,
    historyStore: deps.historyStore,
    ui: deps.ui,
    settings: deps.settings,
  }

  const exportDeps: ExportServiceDeps = {
    ...deps,
    pdfRepository,
  }

  const importService = createDocumentImportService(importDeps)
  const exportService = createDocumentExportService(exportDeps)

  return {
    ...importService,
    ...exportService,
    dispose() {
      exportService.dispose()
    },
  }
}

export type ProjectSessionServices = ReturnType<typeof createProjectSessionServices>
export type {
  ImportOptions,
  ImportSummary,
  ImportServiceDeps,
  ImportUiBindings,
  ImportServiceSettings,
} from '@/domains/import/application/import-service'
export type {
  ExportCompressionBindings,
  ExportOptions,
  ExportResult,
  ExportServiceDeps,
  ExportServiceSettings,
  ExportUiBindings,
  GeneratorOptions,
} from '@/domains/export/application/export-service'
export type { PdfRepository }
