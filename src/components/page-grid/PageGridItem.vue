<script setup lang="ts">
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuLabel,
} from '@/components/ui/context-menu'
import { RotateCw, RotateCcw, Trash2, Copy, Eye, CheckSquare, Download } from 'lucide-vue-next'
import PdfThumbnail from '../PdfThumbnail.vue'
import { UserAction } from '@/types/actions'
import type { PageReference } from '@/types'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  page: PageReference
  index: number
  pageNumber: number
  selected: boolean
  isStartOfFile: boolean
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  preview: [pageRef: PageReference]
  contextAction: [action: UserAction, pageRef: PageReference]
}>()

function handlePageClick(event: MouseEvent) {
  if (props.state.currentTool.value === 'razor') {
    const pages = props.state.document.pages
    const index = pages.findIndex((p) => p.id === props.page.id)
    const prevPage = pages[index - 1]

    // Prevent invalid splits
    if (index > 0 && index < pages.length - 1 && prevPage && !prevPage.isDivider) {
      props.actions.handleSplitGroup(index)
    }
    return
  }

  // Selection Logic
  if (event.metaKey || event.ctrlKey) {
    props.actions.togglePageSelection(props.page.id)
  } else if (event.shiftKey && props.state.document.lastSelectedId) {
    props.actions.selectRange(props.state.document.lastSelectedId, props.page.id)
  } else {
    const isOnlySelected =
      props.state.document.selectedIds.has(props.page.id) &&
      props.state.document.selectedCount === 1
    if (isOnlySelected) {
      props.actions.clearSelection()
    } else {
      props.actions.selectPage(props.page.id, false)
    }
  }
}

function handlePreview() {
  emit('preview', props.page)
}

function handleDelete() {
  emit('contextAction', UserAction.DELETE, props.page)
}

function handleRotate() {
  emit('contextAction', UserAction.ROTATE_RIGHT, props.page)
}
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger>
      <PdfThumbnail
        :page-ref="page"
        :page-number="pageNumber"
        :selected="selected"
        :fixed-size="true"
        :width="state.zoom.value"
        :source-color="state.document.getSourceColor(page.sourceFileId)"
        :is-start-of-file="isStartOfFile"
        :is-razor-active="state.currentTool.value === 'razor'"
        :can-split="index > 0"
        @click="handlePageClick"
        @preview="handlePreview"
        @delete="handleDelete"
        @rotate="handleRotate"
      />
    </ContextMenuTrigger>

    <ContextMenuContent>
      <!-- Header/Label -->
      <ContextMenuLabel
        class="text-xs text-text-muted font-medium border-b border-border px-3 py-2"
      >
        {{
          state.document.selectedCount > 1
            ? `${state.document.selectedCount} pages selected`
            : `Page ${pageNumber}`
        }}
      </ContextMenuLabel>

      <ContextMenuItem @select="handlePreview">
        <Eye class="w-4 h-4 mr-2 text-text-muted" />
        <span>Preview</span>
        <ContextMenuShortcut>Space</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuItem @select="emit('contextAction', UserAction.DUPLICATE, page)">
        <Copy class="w-4 h-4 mr-2 text-text-muted" />
        <span>Duplicate</span>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem @select="emit('contextAction', UserAction.ROTATE_LEFT, page)">
        <RotateCcw class="w-4 h-4 mr-2 text-text-muted" />
        <span>Rotate Left</span>
        <ContextMenuShortcut>⇧R</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuItem @select="emit('contextAction', UserAction.ROTATE_RIGHT, page)">
        <RotateCw class="w-4 h-4 mr-2 text-text-muted" />
        <span>Rotate Right</span>
        <ContextMenuShortcut>R</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <template v-if="state.document.selectedCount > 0">
        <ContextMenuItem @select="emit('contextAction', UserAction.SELECT_ALL, page)">
          <CheckSquare class="w-4 h-4 mr-2 text-text-muted" />
          <span>Select All</span>
          <ContextMenuShortcut>⌘A</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem @select="emit('contextAction', UserAction.EXPORT_SELECTED, page)">
          <Download class="w-4 h-4 mr-2 text-text-muted" />
          <span>Export Selected</span>
          <ContextMenuShortcut>⌘A</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />
      </template>

      <ContextMenuItem
        class="text-danger focus:text-danger focus:bg-danger/10"
        @select="handleDelete"
      >
        <Trash2 class="w-4 h-4 mr-2" />
        <span>Delete</span>
        <ContextMenuShortcut class="text-danger/50">Del</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
