import { PROGRESS } from '@/shared/constants'
import type { DocumentErrorCode } from '@/shared/types/errors'

export type JobStatus = 'idle' | 'running' | 'success' | 'error'

export interface JobState {
  status: JobStatus
  progress: number
  error: string | null
  errorCode?: DocumentErrorCode | null
}

export function createJobState(): JobState {
  return {
    status: 'idle',
    progress: PROGRESS.MIN,
    error: null,
    errorCode: null,
  }
}
