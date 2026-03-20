import { ref, reactive } from 'vue'
import { createJobState, type JobState } from '@/shared/types/jobs'

export function createImportOperationState() {
  const importJob = ref<JobState>(createJobState())

  function resetImportJob() {
    importJob.value = createJobState()
  }

  return reactive({
    importJob,
    resetImportJob,
  })
}

export type ImportOperationState = ReturnType<typeof createImportOperationState>
