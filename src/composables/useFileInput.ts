import { shallowRef } from 'vue'
import { createSharedComposable } from '@vueuse/core'

const useSharedFileInput = createSharedComposable(() => {
  const fileInputRef = shallowRef<HTMLInputElement | null>(null)

  function setFileInputRef(el: HTMLInputElement | null) {
    fileInputRef.value = el
  }

  function openFileDialog() {
    fileInputRef.value?.click()
  }

  function clearFileInput() {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }

  return {
    fileInputRef,
    setFileInputRef,
    openFileDialog,
    clearFileInput,
  }
})

export function useFileInput() {
  return useSharedFileInput()
}

export type FileInputState = ReturnType<typeof useFileInput>
