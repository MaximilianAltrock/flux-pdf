<script setup lang="ts">
import { computed } from 'vue'

// Components
import MicroHeader from '@/domains/editor/ui/components/MicroHeader.vue'
import SourceRail from '@/domains/editor/ui/components/SourceRail.vue'
import InspectorPanel from '@/domains/editor/ui/components/inspector/InspectorPanel.vue'
import PageGrid from '@/domains/editor/ui/components/PageGrid.vue'
import FileDropzone from '@/domains/editor/ui/components/FileDropzone.vue'
import CommandPalette from '@/domains/editor/ui/components/CommandPalette.vue'
import PreflightStatusBar from '@/domains/editor/ui/components/preflight/PreflightStatusBar.vue'
import PreflightPanel from '@/domains/editor/ui/components/preflight/PreflightPanel.vue'
import { Spinner } from '@/shared/components/ui/spinner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/shared/components/ui/resizable'

import type { PageReference } from '@/shared/types'
import type { UserAction } from '@/shared/types/actions'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useUiStore } from '@/domains/editor/store/ui.store'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { withPrimaryModifier } from '@/shared/utils/shortcuts'

const ui = useUiStore()
const document = useDocumentStore()
const actions = useDocumentActionsContext()
const commandPaletteShortcut = withPrimaryModifier('K')

// Local computed for template readability
const hasPages = computed(() => document.pageCount > 0)
const isLoading = computed(() => ui.isLoading)
const loadingMessage = computed(() => ui.loadingMessage)

// Event handlers that delegate to actions
function onFilesDropped(files: FileList) {
  actions.handleFilesSelected(files)
}

function onSourceDropped(sourceId: string) {
  actions.handleSourceDropped(sourceId)
}

function onSourcePageDropped(sourceId: string, pageIndex: number) {
  actions.handleSourcePageDropped(sourceId, pageIndex)
}

function onSourcePagesDropped(pages: { sourceId: string; pageIndex: number }[]) {
  actions.handleSourcePagesDropped(pages)
}

function onPreview(pageRef: PageReference) {
  actions.handlePagePreview(pageRef)
}

function onContextAction(action: UserAction, pageRef: PageReference) {
  actions.handleContextAction(action, pageRef)
}

function onRemoveSource(sourceId: string) {
  actions.handleRemoveSource(sourceId)
}

function onCommandAction(action: UserAction) {
  actions.handleCommandAction(action)
}

async function onClearProject() {
  await actions.handleClearProject()
}

async function onDeleteProject() {
  await actions.handleDeleteProject()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <MicroHeader
      @command="ui.openCommandPalette"
      @export="actions.handleExport"
      @zoom-in="actions.zoomIn"
      @zoom-out="actions.zoomOut"
      @new-project="actions.handleNewProject"
      @clear-project="onClearProject"
      @delete-project="onDeleteProject"
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
              <FileDropzone
                @files-selected="onFilesDropped"
                @source-dropped="onSourceDropped"
                @source-page-dropped="onSourcePageDropped"
                @source-pages-dropped="onSourcePagesDropped"
              />
              <div class="mt-8 text-center text-muted-foreground">
                <p class="mb-4 text-sm font-medium">
                  Or drag files from your desktop or sources panel
                </p>
                <div
                  class="flex flex-wrap justify-center gap-2 ui-kicker opacity-70"
                >
                  <span class="px-2 py-1 ui-panel-muted ui-mono">
                    {{ commandPaletteShortcut }} for commands
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Page Grid -->
          <PageGrid
            v-else
            @files-dropped="onFilesDropped"
            @source-dropped="onSourceDropped"
            @source-page-dropped="onSourcePageDropped"
            @source-pages-dropped="onSourcePagesDropped"
            @preview="onPreview"
            @context-action="onContextAction"
          />

          <!-- Loading Overlay -->
          <Transition name="fade">
            <div
              v-if="isLoading"
              class="absolute inset-0 bg-background/90 flex items-center justify-center z-50"
            >
              <div class="flex flex-col items-center gap-3">
                <Spinner class="w-10 h-10 text-primary" />
                <span class="ui-caption">{{ loadingMessage }}</span>
              </div>
            </div>
          </Transition>
        </main>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <!-- Inspector Panel (Right Sidebar) -->
      <InspectorPanel />
    </ResizablePanelGroup>

    <PreflightStatusBar />

    <!-- Command Palette -->
    <CommandPalette
      :open="ui.showCommandPalette"
      @update:open="(val) => !val && ui.closeCommandPalette()"
      @action="onCommandAction"
    />

    <PreflightPanel
      :open="ui.showPreflightPanel"
      @update:open="(val) => (val ? ui.openPreflightPanel() : ui.closePreflightPanel())"
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

