<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Moon, SlidersHorizontal, Sun } from 'lucide-vue-next'
import { useMobile } from '@/shared/composables/useMobile'
import { useThemeToggle } from '@/domains/workspace/application/useThemeToggle'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'
import MenuDrawerSourcesSection from '@/domains/editor/ui/components/mobile/menu-drawer/MenuDrawerSourcesSection.vue'
import MenuDrawerHistorySection from '@/domains/editor/ui/components/mobile/menu-drawer/MenuDrawerHistorySection.vue'
import MenuDrawerFooterActions from '@/domains/editor/ui/components/mobile/menu-drawer/MenuDrawerFooterActions.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  removeSource: [sourceId: string]
  newProject: []
  dashboard: []
  settings: []
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()
const { historyList, jumpTo } = actions
const { haptic } = useMobile()
const { toggleTheme } = useThemeToggle()

const sources = computed(() => document.sourceFileList)
const totalSize = computed(() =>
  Array.from(document.sources.values()).reduce((total, source) => total + source.fileSize, 0),
)

function handleRemoveSource(sourceId: string) {
  haptic('medium')
  emit('removeSource', sourceId)
}

function handleHistoryJump(pointer: number) {
  haptic('light')
  jumpTo(pointer)
}

function handleNewProject() {
  haptic('medium')
  emit('newProject')
  emit('update:open', false)
}

function handleDashboard() {
  haptic('light')
  emit('dashboard')
  emit('update:open', false)
}

function handleSettings() {
  haptic('light')
  emit('settings')
  emit('update:open', false)
}
</script>

<template>
  <Sheet :open="props.open" @update:open="(value: boolean) => emit('update:open', value)">
    <SheetContent
      side="left"
      class="w-[90vw] max-w-sm p-0 flex flex-col gap-0 border-r border-border bg-card min-h-0"
    >
      <SheetHeader
        class="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border/70 space-y-0 flex-row"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
            <div class="w-4 h-4 bg-primary rounded-sm" />
          </div>
          <div class="flex flex-col">
            <SheetTitle class="font-bold text-foreground text-base">FluxPDF</SheetTitle>
            <SheetDescription class="sr-only">
              Document menu with sources, history, and details.
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea class="flex-1 min-h-0">
        <div class="flex flex-col">
          <MenuDrawerSourcesSection
            :page-count="document.pageCount"
            :sources="sources"
            :total-size="totalSize"
            @remove-source="handleRemoveSource"
          />

          <Separator />

          <MenuDrawerHistorySection :history-list="historyList" @jump="handleHistoryJump" />

          <Separator />

          <div class="px-4 py-4">
            <Button
              variant="outline"
              class="w-full justify-between h-12 px-4"
              @click="handleSettings"
            >
              <div class="flex items-center gap-3">
                <SlidersHorizontal class="w-4 h-4 text-muted-foreground" />
                <span class="text-sm">Document Details</span>
              </div>
              <ChevronRight class="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <Separator />

          <div class="px-4 py-4">
            <Button
              variant="outline"
              class="w-full justify-between h-12 px-4"
              @click="toggleTheme"
            >
              <div class="flex items-center gap-3">
                <span class="relative flex h-5 w-5 items-center justify-center">
                  <Sun
                    class="absolute h-5 w-5 text-muted-foreground rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
                  />
                  <Moon
                    class="absolute h-5 w-5 text-muted-foreground rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
                  />
                </span>
                <span class="text-sm">Appearance</span>
              </div>
              <ChevronRight class="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </ScrollArea>

      <MenuDrawerFooterActions @dashboard="handleDashboard" @new-project="handleNewProject" />
    </SheetContent>
  </Sheet>
</template>

