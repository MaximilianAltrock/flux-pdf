import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const useSettingsStore = defineStore('settings', () => {
  const autoGenerateOutlineSinglePage = useLocalStorage<boolean>(
    'fluxpdf:outline:autoSinglePage',
    true,
  )

  return {
    autoGenerateOutlineSinglePage,
  }
})
