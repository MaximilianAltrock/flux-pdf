<script setup lang="ts">
import { shallowRef, watch, nextTick, useTemplateRef } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import { useMobile } from '@/composables/useMobile'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useDocumentStore } from '@/stores/document'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { haptic } = useMobile()
const actions = useDocumentActionsContext()
const document = useDocumentStore()

const inputRef = useTemplateRef<InstanceType<typeof Input>>('inputRef')
const editedTitle = shallowRef('')
const { start: startFocusTimer, stop: stopFocusTimer } = useTimeoutFn(
  () => {
    const el =
      inputRef.value?.$el?.querySelector?.('input') || inputRef.value?.$el || inputRef.value
    el?.focus()
    el?.select?.()
  },
  150,
  { immediate: false },
)

watch(
  () => props.open,
  async (isOpen) => {
    stopFocusTimer()
    if (isOpen) {
      editedTitle.value = document.projectTitle
      await nextTick()
      // Small delay to let the drawer animate in
      // Since Input might be a functional component or nested, we try to find the actual input
      startFocusTimer()
    }
  },
  { immediate: true },
)

function handleSave() {
  actions.commitProjectTitle(editedTitle.value)
  haptic('light')
  emit('update:open', false)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSave()
  }
}
</script>

<template>
  <Drawer :open="open" @update:open="(val: boolean) => emit('update:open', val)">
    <DrawerContent>
      <div class="mx-auto w-full max-w-sm">
        <DrawerHeader>
          <DrawerTitle class="text-center">Rename Project</DrawerTitle>
          <DrawerDescription class="sr-only">
            Update the project title used for exports.
          </DrawerDescription>
        </DrawerHeader>

        <!-- Content -->
        <div class="px-4 pb-4">
          <Input
            ref="inputRef"
            v-model="editedTitle"
            type="text"
            placeholder="Enter project name"
            class="h-11 text-sm"
            @keydown="handleKeydown"
          />
          <p class="mt-2 ui-caption px-1 text-center">
            This will be the filename when you export
          </p>
        </div>

        <!-- Actions -->
        <DrawerFooter class="pt-0">
          <Button class="w-full h-11 text-sm font-semibold" @click="handleSave">Save</Button>
          <!-- Safe Area -->
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>

