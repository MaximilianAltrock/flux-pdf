<script setup lang="ts">
import { computed, ref, inject, provide, type Ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { ChevronRight, Crosshair } from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import type { UiBookmarkNode } from '@/types'

defineOptions({ name: 'BookmarkTree' })

const props = defineProps<{
  nodes: UiBookmarkNode[]
  depth?: number
}>()

const emit = defineEmits<{
  (e: 'update:nodes', value: UiBookmarkNode[]): void
}>()

const store = useDocumentStore()
const depth = computed(() => props.depth ?? 0)

const dragState = inject<Ref<boolean> | null>('bookmarkDragState', null)
const isDragging = dragState ?? ref(false)
if (!dragState) {
  provide('bookmarkDragState', isDragging)
}

const localNodes = computed({
  get: () => props.nodes,
  set: (val) => emit('update:nodes', val),
})

const isEmpty = computed(() => localNodes.value.length === 0)

const renameId = ref<string | null>(null)
const renameText = ref('')


function indentPx() {
  return 10 + depth.value * 14
}

function scrollGridToPage(pageId: string) {
  const el = document.getElementById(`page-${pageId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    store.selectPage(pageId, false)
  }
}

function toggleExpanded(n: UiBookmarkNode) {
  n.expanded = !n.expanded
  store.markBookmarksDirty()
}

function beginRename(n: UiBookmarkNode) {
  renameId.value = n.id
  renameText.value = n.title
}

function commitRename(n: UiBookmarkNode) {
  const t = renameText.value.trim()
  n.title = t.length ? t : n.title
  renameId.value = null
  renameText.value = ''
  store.markBookmarksDirty()
}

function onDragStart() {
  isDragging.value = true
}
function onDragEnd() {
  isDragging.value = false
  store.markBookmarksDirty()
}

</script>

<template>
  <VueDraggable
    v-model="localNodes"
    item-key="id"
    :draggable="'.bookmark-item'"
    :group="{ name: 'bookmarks', pull: true, put: true }"
    :animation="150"
    ghost-class="bookmark-ghost"
    drag-class="bookmark-drag"
    chosen-class="bookmark-chosen"
    @start="onDragStart"
    @end="onDragEnd"
  >
    <div v-for="element in localNodes" :key="element.id" class="bookmark-item">
      <!-- Row -->
      <div
        class="group flex items-center h-7 px-2 hover:bg-surface-hover cursor-default transition-colors"
        :style="{ paddingLeft: indentPx() + 'px' }"
        @dblclick="beginRename(element)"
      >
        <!-- Expander -->
        <button
          class="mr-1 text-text-muted/70 hover:text-text transition-colors"
          @click.stop="toggleExpanded(element)"
          :style="{ opacity: element.children?.length ? 1 : 0.25 }"
        >
          <ChevronRight
            class="w-3.5 h-3.5 transition-transform"
            :class="element.expanded ? 'rotate-90' : ''"
          />
        </button>

        <!-- Title / Rename -->
        <div class="flex-1 min-w-0">
          <input
            v-if="renameId === element.id"
            v-model="renameText"
            class="ui-input-compact"
            @keydown.enter.prevent="commitRename(element)"
            @blur="commitRename(element)"
            autofocus
          />
          <span v-else class="text-xs text-text-primary truncate flex-1 font-medium">
            {{ element.title }}
          </span>
        </div>

        <!-- Target Action -->
        <button
          @click.stop="scrollGridToPage(element.pageId)"
          class="opacity-0 group-hover:opacity-100 p-1 hover:text-primary transition-opacity"
          title="Jump to section"
        >
          <Crosshair class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Children -->
      <div v-if="element.expanded || isDragging">
        <BookmarkTree
          :nodes="element.children ?? []"
          :depth="(depth ?? 0) + 1"
          @update:nodes="
            (newChildren) => {
              element.children = newChildren
              if (newChildren.length) element.expanded = true
              store.markBookmarksDirty()
            }
          "
        />
      </div>
    </div>

    <div v-if="isEmpty && isDragging" class="bookmark-empty text-[10px] text-text-muted">
      Drop here to nest
    </div>
  </VueDraggable>
</template>

<style scoped>
.bookmark-ghost {
  opacity: 0.25;
  filter: grayscale(1);
}
.bookmark-drag {
  opacity: 1 !important;
  transform: scale(1.02);
  z-index: 50;
}
.bookmark-chosen {
  opacity: 0.9;
}
.bookmark-empty {
  padding: 6px 10px;
  margin-left: 14px;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 6px;
}
</style>
