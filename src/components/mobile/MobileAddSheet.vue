<script setup lang="ts">
import { ref, computed } from 'vue'
import { Camera, FolderOpen } from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
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

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  selectFiles: [insertAtEnd: boolean]
  takePhoto: []
}>()

const store = useDocumentStore()
const { haptic } = useMobile()

const insertAtEnd = ref('true')
const hasExistingPages = computed(() => store.pageCount > 0)

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
            variant="ghost"
            class="w-full flex items-center gap-4 p-4 h-auto bg-background border border-border rounded-xl active:bg-muted/20 transition-colors"
            @click="handleSelectFiles"
          >
            <div
              class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
            >
              <FolderOpen class="w-6 h-6 text-primary" />
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium text-foreground">Browse Files</div>
              <div class="text-sm text-muted-foreground">Select PDF or images</div>
            </div>
          </Button>

          <!-- Camera (for scanning) -->
          <Button
            variant="ghost"
            class="w-full flex items-center gap-4 p-4 h-auto bg-background border border-border rounded-xl active:bg-muted/20 transition-colors"
            @click="handleTakePhoto"
          >
            <div
              class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
            >
              <Camera class="w-6 h-6 text-primary" />
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium text-foreground">Take Photo</div>
              <div class="text-sm text-muted-foreground">Scan a document</div>
            </div>
          </Button>
        </div>

        <!-- Insert Position (only show if pages exist) -->
        <div v-if="hasExistingPages" class="px-4 pb-4">
          <div class="text-xs text-muted-foreground uppercase font-medium mb-3 px-1 text-center">
            Insert Position
          </div>
          <ToggleGroup
            type="single"
            v-model="insertAtEnd"
            class="w-full flex bg-muted/50 p-1 rounded-xl"
            variant="outline"
          >
            <ToggleGroupItem
              value="true"
              class="flex-1 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              At End
            </ToggleGroupItem>
            <ToggleGroupItem
              value="false"
              class="flex-1 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm"
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

