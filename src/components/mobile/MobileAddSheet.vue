<script setup lang="ts">
import { ref, computed } from 'vue'
import { Camera, FolderOpen } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'

import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  open: boolean
  state: FacadeState
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  selectFiles: [insertAtEnd: boolean]
  takePhoto: []
}>()

const { haptic } = useMobile()

const insertAtEnd = ref('true')
const hasExistingPages = computed(() => props.state.document.pageCount > 0)

function handleSelectFiles() {
  haptic('light')
  emit('selectFiles', insertAtEnd.value === 'true')
  emit('update:open', false)
}

function handleTakePhoto() {
  haptic('light')
  emit('takePhoto')
  emit('update:open', false)
}
</script>

<template>
  <Drawer :open="open" @update:open="(val) => emit('update:open', val)">
    <DrawerContent>
      <div class="mx-auto w-full max-w-sm">
        <DrawerHeader>
          <DrawerTitle class="text-center">Add Pages</DrawerTitle>
        </DrawerHeader>

        <!-- Options -->
        <div class="px-4 py-4 space-y-3">
          <!-- Browse Files -->
          <Button
            variant="outline"
            class="w-full flex items-center gap-4 p-3 h-auto rounded-md"
            @click="handleSelectFiles"
          >
            <div
              class="w-10 h-10 rounded-md bg-muted/20 border border-border flex items-center justify-center shrink-0"
            >
              <FolderOpen class="w-6 h-6 text-primary" />
            </div>
            <div class="flex-1 text-left">
              <div class="ui-label text-foreground">Browse Files</div>
              <div class="ui-caption">Select PDF or images</div>
            </div>
          </Button>

          <!-- Camera (for scanning) -->
          <Button
            variant="outline"
            class="w-full flex items-center gap-4 p-3 h-auto rounded-md"
            @click="handleTakePhoto"
          >
            <div
              class="w-10 h-10 rounded-md bg-muted/20 border border-border flex items-center justify-center shrink-0"
            >
              <Camera class="w-6 h-6 text-primary" />
            </div>
            <div class="flex-1 text-left">
              <div class="ui-label text-foreground">Take Photo</div>
              <div class="ui-caption">Scan a document</div>
            </div>
          </Button>
        </div>

        <!-- Insert Position (only show if pages exist) -->
        <div v-if="hasExistingPages" class="px-4 pb-4">
          <div class="ui-kicker mb-3 px-1 text-center">Insert Position</div>
          <ToggleGroup
            type="single"
            v-model="insertAtEnd"
            class="w-full flex ui-panel-muted p-1 rounded-sm"
            variant="outline"
            size="sm"
            :spacing="0"
          >
            <ToggleGroupItem
              value="true"
              class="flex-1"
            >
              At End
            </ToggleGroupItem>
            <ToggleGroupItem
              value="false"
              class="flex-1"
            >
              At Start
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <DrawerFooter class="pt-0">
          <!-- Safe Area -->
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>

