import { ref, shallowRef, reactive } from 'vue'
import { createJobState, type JobState } from '@/shared/types/jobs'

export function createExportOperationState() {
  const showExportModal = shallowRef(false)
  const exportSelectedOnly = shallowRef(false)
  const exportJob = ref<JobState>(createJobState())

  function openExportModal(selectedOnly = false) {
    exportSelectedOnly.value = selectedOnly
    showExportModal.value = true
  }

  function closeExportModal() {
    showExportModal.value = false
  }

  function resetExportJob() {
    exportJob.value = createJobState()
  }

  return reactive({
    showExportModal,
    exportSelectedOnly,
    exportJob,
    openExportModal,
    closeExportModal,
    resetExportJob,
  })
}

export type ExportOperationState = ReturnType<typeof createExportOperationState>
