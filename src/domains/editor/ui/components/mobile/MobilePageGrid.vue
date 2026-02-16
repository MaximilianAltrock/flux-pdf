<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, Scissors } from 'lucide-vue-next'
import { useMobile } from '@/shared/composables/useMobile'
import { useGridLogic } from '@/domains/editor/ui/useGridLogic'
import PdfThumbnail from '@/domains/editor/ui/components/PdfThumbnail.vue'
import PageDivider from '@/domains/editor/ui/components/grid/PageDivider.vue'
import MobileGridModeBanner from '@/domains/editor/ui/components/mobile/MobileGridModeBanner.vue'
import MobileGridMarkerButton from '@/domains/editor/ui/components/mobile/MobileGridMarkerButton.vue'
import { type PageReference } from '@/shared/types'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { useUiStore } from '@/domains/editor/store/ui.store'
import { usePreflight } from '@/domains/editor/application/usePreflight'
import { usePageProblemMeta } from '@/domains/editor/ui/usePageProblemMeta'
import { useMobileGridTargets } from '@/domains/editor/ui/useMobileGridTargets'
import { useMobileGridGestures } from '@/domains/editor/ui/useMobileGridGestures'
import { useMobileEditorMode } from '@/domains/editor/ui/useMobileEditorMode'

const emit = defineEmits<{
  preview: [pageRef: PageReference]
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()
const ui = useUiStore()
const preflight = usePreflight()
const { haptic } = useMobile()
const { localPages, isSelected, contentPages, getContentPageNumber } = useGridLogic(document)

const { isSplit, isBrowse, isSelect, isMove } = useMobileEditorMode(
  () => ui.mobileMode,
  () => ui.currentTool,
)

const selectedCount = computed(() => document.selectedCount)
const selectedIds = computed(() => document.selectedIds)

const { getPageProblemMeta } = usePageProblemMeta(preflight.problemsByPageId)

const { splitTargets, dropTargets } = useMobileGridTargets({
  localPages,
  selectedIds,
  isSplit,
  isMove,
})

const { gridStyle, longPressPageId, handleTouchStart, handleTouchMove, handleTouchEnd } =
  useMobileGridGestures({
    isBrowse,
    isMove,
    isSplit,
    onLongPressPage: (pageId) => {
      actions.enterMobileSelectionMode()
      actions.selectPage(pageId, false)
    },
    haptic,
  })

function handlePageTap(page: PageReference, event: Event) {
  event.preventDefault()

  if (isMove.value || isSplit.value) return

  if (isSelect.value) {
    haptic('light')
    actions.togglePageSelection(page.id)
    return
  }

  emit('preview', page)
}

function handleDropMarkerTap(index: number) {
  actions.handleMoveSelectedToPosition(index)
}

function handleSplitMarkerTap(index: number) {
  actions.handleSplitGroup(index)
}

function preventContextMenu(event: Event) {
  event.preventDefault()
}
</script>

<template>
  <div
    class="h-full overflow-y-auto overflow-x-hidden grid-touch-area no-scrollbar"
    :class="isMove || isSplit ? 'bg-muted/20' : 'bg-background'"
    @contextmenu="preventContextMenu"
  >
    <MobileGridModeBanner :visible="isSplit" message="Tap between pages to split" />
    <MobileGridModeBanner
      :visible="isMove"
      :message="`Tap where to move ${selectedCount} page${selectedCount > 1 ? 's' : ''}`"
    />

    <!-- Page Grid -->
    <div class="grid gap-3 p-4 min-h-[50vh]" :style="gridStyle">
      <template v-for="(pageRef, index) in localPages" :key="pageRef.id">
        <!-- Split marker before this page (in Split mode) -->
        <MobileGridMarkerButton
          v-if="isSplit && splitTargets.has(index)"
          label="Split here"
          @select="handleSplitMarkerTap(index)"
        >
          <Scissors class="w-4 h-4" />
        </MobileGridMarkerButton>

        <!-- Drop marker before this page (in Move mode) -->
        <MobileGridMarkerButton
          v-if="isMove && dropTargets.has(index) && !selectedIds.has(pageRef.id)"
          label="Insert here"
          @select="handleDropMarkerTap(index)"
        >
          <ArrowDown class="w-4 h-4" />
        </MobileGridMarkerButton>

        <!-- Section Divider -->
        <PageDivider v-if="pageRef.isDivider" variant="mobile" class="col-span-full" />

        <!-- Page Thumbnail -->
        <div
          v-else
          :data-mobile-page-id="pageRef.id"
          class="relative transition-opacity duration-200"
          :class="{
            'opacity-40': isMove && selectedIds.has(pageRef.id),
          }"
          @touchstart="handleTouchStart(pageRef.id)"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @click="handlePageTap(pageRef, $event)"
        >
          <!-- Long press highlight -->
          <Transition name="fade">
            <div
              v-if="longPressPageId === pageRef.id"
              class="absolute inset-0 bg-primary/20 rounded-lg z-10 pointer-events-none"
            />
          </Transition>

          <PdfThumbnail
            :page-ref="pageRef"
            :page-number="getContentPageNumber(pageRef.id)"
            :selected="isSelect && isSelected(pageRef.id)"
            :fixed-size="false"
            :width="300"
            :source-color="document.getSourceColor(pageRef.sourceFileId)"
            :is-start-of-file="false"
            :is-razor-active="false"
            :can-split="false"
            :problem-severity="getPageProblemMeta(pageRef.id).severity"
            :problem-messages="getPageProblemMeta(pageRef.id).messages"
            class="pointer-events-none"
          />
        </div>
      </template>

      <!-- Drop marker at end (in Move mode) -->
      <MobileGridMarkerButton
        v-if="isMove && dropTargets.has(localPages.length)"
        label="Move to end"
        @select="handleDropMarkerTap(localPages.length)"
      >
        <ArrowDown class="w-4 h-4" />
      </MobileGridMarkerButton>
    </div>

    <!-- Helper text -->
    <p v-if="contentPages.length > 0 && !isMove && !isSplit" class="text-center ui-caption py-4 px-6">
      <template v-if="isSelect"> Tap pages to select </template>
      <template v-else> Long-press to select / Tap to preview </template>
    </p>

    <!-- Empty state -->
    <div
      v-if="contentPages.length === 0"
      class="absolute inset-0 flex items-center justify-center p-8"
    >
      <div class="text-center text-muted-foreground">
        <p class="text-sm font-semibold mb-2">No pages yet</p>
        <p class="text-xs">Tap + to add a PDF</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.grid-touch-area {
  touch-action: pan-y;
  overscroll-behavior: contain;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>



