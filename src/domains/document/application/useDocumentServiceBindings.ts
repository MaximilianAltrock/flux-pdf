import { usePdfRepository } from '@/domains/document/infrastructure/pdf.repository'
import { createDocumentService } from '@/domains/document/application/document.service'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useHistoryStore } from '@/domains/history/store/history.store'
import type { JobState } from '@/shared/types/jobs'
import type { Ref } from 'vue'

export interface DocumentServiceBindingsDeps {
  documentStore: ReturnType<typeof useDocumentStore>
  historyStore: ReturnType<typeof useHistoryStore>
  ui: {
    setLoading: (loading: boolean, message?: string) => void
    importJob: Ref<JobState>
    exportJob: Ref<JobState>
  }
  settings: {
    autoGenerateOutlineSinglePage: Ref<boolean>
    filenamePattern: Ref<string>
  }
}

export function useDocumentServiceBindings({
  documentStore,
  historyStore,
  ui,
  settings,
}: DocumentServiceBindingsDeps) {
  const pdfRepository = usePdfRepository()
  return createDocumentService({
    documentStore,
    historyStore,
    pdfRepository,
    ui,
    settings,
  })
}
