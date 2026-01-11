<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore } from '@/stores/document'

// Components
import MicroHeader from '@/components/MicroHeader.vue'
import SourceRail from '@/components/SourceRail.vue'
import InspectorPanel from '@/components/InspectorPanel.vue'
import PageGrid from '@/components/PageGrid.vue'
import FileDropzone from '@/components/FileDropzone.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { Spinner } from '@/components/ui/spinner'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

import type { PageReference } from '@/types'
import type { UserAction } from '@/types/actions'
import type { AppState } from '@/composables/useAppState'
import type { AppActions } from '@/composables/useAppActions'

// Props - receive state and actions from parent
const props = defineProps<{
  state: AppState
  actions: AppActions
}>()

const store = useDocumentStore()

// Local computed for template readability
const hasPages = computed(() => store.pageCount > 0)
const isLoading = computed(() => store.isLoading)
const loadingMessage = computed(() => store.loadingMessage)

// Event handlers that delegate to actions
function onFilesDropped(files: FileList) {
  props.actions.handleFilesSelected(files)
}

function onSourceDropped(sourceId: string) {
  props.actions.handleSourceDropped(sourceId)
}

function onPreview(pageRef: PageReference) {
  props.actions.handlePagePreview(pageRef)
}

function onContextAction(action: UserAction, pageRef: PageReference) {
  props.actions.handleContextAction(action, pageRef)
}

function onRemoveSource(sourceId: string) {
  props.actions.handleRemoveSource(sourceId)
}

function onCommandAction(action: UserAction) {
  props.actions.handleCommandAction(action)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <MicroHeader
      :title="props.state.documentTitle.value"
      @update:title="props.state.updateDocumentTitle"
      @command="props.state.openCommandPalette"
      @export="props.actions.handleExport"
      @zoom-in="props.actions.zoomIn"
      @zoom-out="props.actions.zoomOut"
      @new-project="props.actions.handleNewProject"
    />
    <!-- Main Content Area -->
    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <!-- Source Rail (Left Sidebar) -->
      <SourceRail @remove-source="onRemoveSource" />
      <ResizableHandle withHandle />
      <!-- Main Grid Area -->
      <ResizablePanel as-child :min-size="40">
        <main class="overflow-hidden relative flex flex-col bg-background min-w-0">
        <!-- Empty State -->
        <div v-if="!hasPages" class="h-full flex items-center justify-center p-8">
          <div class="max-w-lg w-full">
            <FileDropzone @files-selected="onFilesDropped" @source-dropped="onSourceDropped" />
            <div class="mt-8 text-center text-muted-foreground">
              <p class="mb-4">Or drag files from your desktop or sources panel</p>
              <div class="flex flex-wrap justify-center gap-2 text-xs opacity-70">
                <span class="px-2 py-1 bg-card rounded">CMD+K for commands</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Page Grid -->
        <PageGrid
          v-else
          @files-dropped="onFilesDropped"
          @source-dropped="onSourceDropped"
          @preview="onPreview"
          @context-action="onContextAction"
        />

        <!-- Loading Overlay -->
        <Transition name="fade">
          <div
            v-if="isLoading"
            class="absolute inset-0 bg-background/80 flex items-center justify-center z-50 backdrop-blur-sm"
          >
            <div class="flex flex-col items-center gap-3">
              <Spinner class="w-10 h-10 text-primary" />
              <span class="text-muted-foreground font-medium">{{ loadingMessage }}</span>
            </div>
          </div>
        </Transition>
        </main>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <!-- Inspector Panel (Right Sidebar) -->
      <InspectorPanel />
    </ResizablePanelGroup>

    <!-- Command Palette -->
    <CommandPalette
      :open="props.state.showCommandPalette.value"
      @update:open="(val) => !val && props.state.closeCommandPalette()"
      @action="onCommandAction"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

