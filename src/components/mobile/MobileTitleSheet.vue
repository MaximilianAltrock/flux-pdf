<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useMobile } from '@/composables/useMobile'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  open: boolean
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { haptic } = useMobile()

const inputRef = ref<InstanceType<typeof Input> | null>(null)
const editedTitle = ref('')

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      editedTitle.value = props.state.document.projectTitle
      await nextTick()
      // Small delay to let the drawer animate in
      setTimeout(() => {
        // Since Input might be a functional component or nested, we try to find the actual input
        const el =
          inputRef.value?.$el?.querySelector?.('input') || inputRef.value?.$el || inputRef.value
        el?.focus()
        el?.select?.()
      }, 150)
    }
  },
  { immediate: true },
)

function handleSave() {
  props.actions.commitProjectTitle(editedTitle.value)
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
        </DrawerHeader>

        <!-- Content -->
        <div class="px-4 pb-4">
          <Input
            ref="inputRef"
            v-model="editedTitle"
            type="text"
            placeholder="Enter project name"
            class="h-10 text-sm"
            @keydown="handleKeydown"
          />
          <p class="mt-2 ui-caption px-1 text-center">
            This will be the filename when you export
          </p>
        </div>

        <!-- Actions -->
        <DrawerFooter class="pt-0">
          <Button class="w-full h-10 text-sm font-semibold" @click="handleSave">Save</Button>
          <!-- Safe Area -->
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>

