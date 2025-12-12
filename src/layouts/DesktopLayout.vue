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

import type { PageReference } from '@/types'
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

function onContextAction(action: string, pageRef: PageReference) {
  props.actions.handleContextAction(action, pageRef)
}

function onRemoveSource(sourceId: string) {
  props.actions.handleRemoveSource(sourceId)
}

function onCommandAction(action: string) {
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
    <div class="flex-1 flex overflow-hidden">
      <!-- Source Rail (Left Sidebar) -->
      <SourceRail @remove-source="onRemoveSource" />

      <!-- Main Grid Area -->
      <main class="flex-1 overflow-hidden relative flex flex-col bg-background">
        <!-- Empty State -->
        <div v-if="!hasPages" class="h-full flex items-center justify-center p-8">
          <div class="max-w-lg w-full">
            <FileDropzone @files-selected="onFilesDropped" @source-dropped="onSourceDropped" />
            <div class="mt-8 text-center text-text-muted">
              <p class="mb-4">Or drag files from your desktop or sources panel</p>
              <div class="flex flex-wrap justify-center gap-2 text-xs opacity-70">
                <span class="px-2 py-1 bg-surface rounded">CMD+K for commands</span>
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
              <svg class="w-10 h-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span class="text-text-muted font-medium">{{ loadingMessage }}</span>
            </div>
          </div>
        </Transition>
      </main>

      <!-- Inspector Panel (Right Sidebar) -->
      <InspectorPanel
        @delete-selected="props.actions.handleDeleteSelected"
        @duplicate-selected="props.actions.handleDuplicateSelected"
        @diff-selected="props.actions.handleDiffSelected"
      />
    </div>

    <!-- Command Palette -->
    <CommandPalette
      :open="props.state.showCommandPalette.value"
      @close="props.state.closeCommandPalette"
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
