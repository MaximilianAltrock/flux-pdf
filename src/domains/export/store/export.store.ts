import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { createJobState, type JobState } from '@/shared/types/jobs'

export const useExportStore = defineStore('export', () => {
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

  return {
    showExportModal,
    exportSelectedOnly,
    exportJob,
    openExportModal,
    closeExportModal,
    resetExportJob,
  }
})
