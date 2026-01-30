<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

// Mobile Components
import MobileTopBar from '@/components/mobile/MobileTopBar.vue'
import MobilePageGrid from '@/components/mobile/MobilePageGrid.vue'
import MobileBottomBar from '@/components/mobile/MobileBottomBar.vue'
import MobileMenuDrawer from '@/components/mobile/MobileMenuDrawer.vue'
import MobileTitleSheet from '@/components/mobile/MobileTitleSheet.vue'
import MobileAddSheet from '@/components/mobile/MobileAddSheet.vue'
import MobileSettingsSheet from '@/components/mobile/MobileSettingsSheet.vue'
import MobileActionSheet from '@/components/mobile/MobileActionSheet.vue'
import { Spinner } from '@/components/ui/spinner'

import type { PageReference } from '@/types'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useUiStore } from '@/stores/ui'
import { useDocumentStore } from '@/stores/document'

const ui = useUiStore()
const document = useDocumentStore()
const actions = useDocumentActionsContext()

const router = useRouter()

// Local computed for template readability
const hasPages = computed(() => document.pageCount > 0)
const isLoading = computed(() => ui.isLoading)
const loadingMessage = computed(() => ui.loadingMessage)
const mode = computed(() => ui.mobileMode)
const isBrowse = computed(() => mode.value === 'browse')

// Event handlers
function onPreview(pageRef: PageReference) {
  actions.handlePagePreview(pageRef)
}

function onRemoveSource(sourceId: string) {
  actions.handleRemoveSource(sourceId)
}

function onDashboard() {
  router.push('/')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Safe Area Top -->
    <div class="pt-[env(safe-area-inset-top)]">
      <MobileTopBar
        @menu="ui.openMenuDrawer"
        @edit-title="ui.openTitleSheet"
      />
    </div>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden relative">
      <!-- Empty State (only in Browse mode) -->
      <div
        v-if="!hasPages && isBrowse"
        class="h-full flex flex-col items-center justify-center p-8"
      >
        <div class="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <svg class="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-foreground mb-2">No PDFs yet</h2>
        <p class="text-sm text-muted-foreground text-center mb-6">
          Tap Add to add your first PDF
        </p>
      </div>

      <!-- Page Grid -->
      <MobilePageGrid v-else @preview="onPreview" />

      <!-- Loading Overlay -->
      <Transition name="fade">
        <div
          v-if="isLoading"
          class="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-50"
        >
          <Spinner class="w-12 h-12 text-primary mb-4" />
          <span class="text-muted-foreground font-medium">{{ loadingMessage }}</span>
        </div>
      </Transition>
    </main>

    <!-- Safe Area Bottom -->
    <div class="pb-[env(safe-area-inset-bottom)]">
      <MobileBottomBar
      @add="ui.openAddSheet"
      @export="actions.handleExport"
      @export-options="actions.openExportOptions(false)"
      @more="ui.openActionSheet"
    />
  </div>

    <!-- Mobile Sheets & Drawers -->
    <MobileMenuDrawer
      :open="ui.showMenuDrawer"
      @update:open="(val) => !val && ui.closeMenuDrawer()"
      @removeSource="onRemoveSource"
      @new-project="actions.handleNewProject"
      @dashboard="onDashboard"
      @settings="ui.openSettingsSheet"
    />

    <MobileTitleSheet
      :open="ui.showTitleSheet"
      @update:open="(val) => !val && ui.closeTitleSheet()"
    />

    <MobileAddSheet
      :open="ui.showAddSheet"
      @update:open="(val) => !val && ui.closeAddSheet()"
      @select-files="actions.handleMobileAddFiles"
      @take-photo="actions.handleMobileTakePhoto"
    />

    <MobileSettingsSheet
      :open="ui.showSettingsSheet"
      @update:open="(val) => !val && ui.closeSettingsSheet()"
    />

    <MobileActionSheet
      :open="ui.showActionSheet"
      @update:open="(val) => !val && ui.closeActionSheet()"
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
