import type { Ref } from 'vue'
import type { Result } from '@/shared/types/result'
import type { FileUploadResult } from '@/shared/types'
import type { JobState } from '@/shared/types/jobs'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { HistoryBatchCommandExecutor } from '@/domains/history/application'

export interface ImportUiBindings {
  setLoading?: (loading: boolean, message?: string) => void
  importJob?: Ref<JobState>
}

export interface ImportServiceSettings {
  autoGenerateOutlineSinglePage: Ref<boolean>
}

export interface ImportSummary {
  results: FileUploadResult[]
  successes: FileUploadResult[]
  errors: FileUploadResult[]
  totalPages: number
}

export interface ImportOptions {
  addPages?: boolean
}

export interface ImportServiceDeps {
  documentStore: DocumentState
  historyStore: HistoryBatchCommandExecutor
  ui?: ImportUiBindings
  settings: ImportServiceSettings
}

export interface ImportService {
  importFiles(
    files: FileList | File[],
    options?: ImportOptions,
  ): Promise<Result<ImportSummary>>
}
