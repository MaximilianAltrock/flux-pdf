<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { RotateCw, RotateCcw, Trash2, Copy, Layers } from 'lucide-vue-next'
import { RotatePagesCommand } from '@/commands'
import PdfThumbnail from './PdfThumbnail.vue'

const store = useDocumentStore()
const { execute, historyList, jumpTo } = useCommandManager()

const hasSelection = computed(() => store.selectedCount > 0)
const singleSelectedPage = computed(() => {
  if (store.selectedCount !== 1) return null
  return store.pages.find((p) => p.id === store.selection.lastSelectedId)
})

const totalSize = computed(() => {
  let size = 0
  for (const source of store.sources.values()) {
    size += source.fileSize
  }
  return size
})

function getSourceName(sourceId?: string) {
  if (!sourceId) return 'Unknown'
  const source = store.sources.get(sourceId)
  return source?.filename || 'Unknown'
}

function rotate(degrees: 90 | -90) {
  if (!hasSelection.value) return
  execute(new RotatePagesCommand(Array.from(store.selection.selectedIds), degrees))
}

const emit = defineEmits<{
  (e: 'delete-selected'): void
  (e: 'duplicate-selected'): void
  (e: 'diff-selected'): void
}>()

function handleDelete() {
  emit('delete-selected')
}

function handleDuplicate() {
  emit('duplicate-selected')
}

function handleDiff() {
  emit('diff-selected')
}

// Format timestamp
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <aside class="w-[260px] bg-surface border-l border-border flex flex-col shrink-0 overflow-hidden">
    <!-- Top Half: Properties -->
    <div class="flex-1 flex flex-col min-h-0 border-b border-border">
      <div class="h-12 border-b border-border flex items-center px-4 bg-surface/50">
        <h2 class="text-xs font-bold text-text-muted uppercase tracking-wider">Properties</h2>
      </div>

      <div class="p-4 overflow-y-auto">
        <!-- SELECTION STATE -->
        <div v-if="hasSelection">
          <!-- SINGLE SELECTION -->
          <div v-if="store.selectedCount === 1" class="mb-6">
            <h3 class="text-sm font-semibold text-text-primary mb-2">Properties</h3>

            <!-- Medium Preview -->
            <div class="flex justify-center mb-4 bg-background p-4 rounded border border-border">
              <PdfThumbnail
                v-if="singleSelectedPage"
                :page-ref="singleSelectedPage"
                :page-number="singleSelectedPage.sourcePageIndex + 1"
                :width="140"
                :is-start-of-file="false"
                :selected="false"
                class="pointer-events-none shadow-md"
              />
            </div>

            <div class="space-y-3">
              <!-- Source File -->
              <div>
                <label
                  class="text-[10px] uppercase font-bold text-text-muted mb-1 block tracking-wider"
                  >Source File</label
                >
                <div
                  class="text-xs text-text truncate bg-background border border-border rounded px-2 py-1.5"
                  :title="getSourceName(singleSelectedPage?.sourceFileId)"
                >
                  {{ getSourceName(singleSelectedPage?.sourceFileId) }}
                </div>
              </div>

              <!-- Rotation Display -->
              <div>
                <label
                  class="text-[10px] uppercase font-bold text-text-muted mb-1 block tracking-wider"
                  >Rotation</label
                >
                <div
                  class="text-xs text-text bg-background border border-border rounded px-2 py-1.5 font-mono"
                >
                  {{ singleSelectedPage?.rotation }}°
                </div>
              </div>
            </div>
          </div>

          <!-- MULTI SELECTION -->
          <div v-else class="mb-6">
            <h3 class="text-sm font-semibold text-text-primary mb-1">Selection</h3>
            <p class="text-xs text-text-muted">{{ store.selectedCount }} Pages Selected</p>
          </div>

          <div class="space-y-4">
            <!-- Actions Grid -->
            <div>
              <span
                class="text-[10px] uppercase font-bold text-text-muted mb-2 block tracking-wider"
                >Actions</span
              >
              <div class="grid grid-cols-2 gap-2">
                <button
                  @click="rotate(-90)"
                  class="flex flex-col items-center justify-center p-3 rounded bg-background border border-border hover:bg-background/80 hover:border-selection transition-all active:scale-95"
                  title="Rotate Left"
                >
                  <RotateCcw class="w-5 h-5 mb-1.5 text-text-muted hover:text-text" />
                  <span class="text-xs text-text font-medium">Left</span>
                </button>
                <button
                  @click="rotate(90)"
                  class="flex flex-col items-center justify-center p-3 rounded bg-background border border-border hover:bg-background/80 hover:border-selection transition-all active:scale-95"
                  title="Rotate Right"
                >
                  <RotateCw class="w-5 h-5 mb-1.5 text-text-muted hover:text-text" />
                  <span class="text-xs text-text font-medium">Right</span>
                </button>
              </div>
            </div>

            <!-- Management -->
            <div class="space-y-2">
              <button
                v-if="store.selectedCount === 2"
                @click="handleDiff"
                class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium text-text bg-background border border-border hover:bg-surface transition-colors"
                title="Compare pages (D)"
              >
                <!-- Icon -->
                <Layers class="w-3.5 h-3.5 text-text-muted" />
                <span>Compare Pages</span>
              </button>
              <button
                @click="handleDuplicate"
                class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium text-text bg-background border border-border hover:bg-surface transition-colors"
              >
                <Copy class="w-3.5 h-3.5 text-text-muted" />
                <span>Duplicate {{ store.selectedCount > 1 ? 'Selection' : 'Page' }}</span>
              </button>

              <button
                @click="handleDelete"
                class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium text-danger bg-background border border-border hover:bg-danger/10 hover:border-danger/30 transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span>Delete {{ store.selectedCount > 1 ? 'Selection' : 'Page' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- NO SELECTION: DOCUMENT SUMMARY -->
        <div v-else class="space-y-6">
          <div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Document Summary</h3>
            <p class="text-xs text-text-muted">No pages selected</p>
          </div>

          <div class="bg-background border border-border rounded-lg p-3 space-y-3">
            <div class="flex justify-between items-center text-xs">
              <span class="text-text-muted">Total Pages</span>
              <span class="font-mono text-text">{{ store.pageCount }}</span>
            </div>
            <div class="flex justify-between items-center text-xs">
              <span class="text-text-muted">Sources</span>
              <span class="font-mono text-text">{{ store.sources.size }}</span>
            </div>

            <div class="flex justify-between items-center text-xs">
              <span class="text-text-muted">Page Size</span>
              <span class="font-mono text-text">A4 / Mixed</span>
            </div>

            <div class="flex justify-between items-center text-xs">
              <span class="text-text-muted">Est. Size</span>
              <!-- Simple estimation: Sum of source file sizes -->
              <span class="font-mono text-text"
                >~{{ (totalSize / 1024 / 1024).toFixed(1) }} MB</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Half: History -->
    <div class="h-2/5 min-h-[220px] flex flex-col bg-background border-t border-border">
      <div class="h-10 border-b border-border flex items-center px-4 bg-surface/50">
        <h2 class="text-xs font-bold text-text-muted uppercase tracking-wider">History</h2>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <ul
          class="relative space-y-0 before:absolute before:inset-y-0 before:left-[19px] before:w-px before:bg-border before:z-0"
        >
          <li
            v-for="(entry, index) in historyList"
            :key="index"
            @click="jumpTo(entry.pointer)"
            class="relative z-10 pl-8 py-2 cursor-pointer group"
          >
            <!-- Timeline Dot -->
            <div
              class="absolute left-[15px] top-3.5 w-[9px] h-[9px] rounded-full border-2 transition-colors z-20 bg-background"
              :class="
                entry.isCurrent
                  ? 'border-selection bg-selection'
                  : entry.isUndone
                    ? 'border-text-muted opacity-50'
                    : 'border-selection bg-background'
              "
            ></div>

            <div
              class="text-xs font-medium transition-colors"
              :class="{
                'text-text-primary': entry.isCurrent,
                'text-text-muted italic opacity-60': entry.isUndone,
                'text-text': !entry.isCurrent && !entry.isUndone,
              }"
            >
              {{ entry.command.name }}
            </div>
            <div class="text-[10px] text-text-muted opacity-50 font-mono mt-0.5">
              {{ formatTime(entry.timestamp) }}
            </div>
          </li>

          <li
            v-if="historyList.length === 0"
            class="pl-8 py-2 text-xs text-text-muted italic opacity-50 relative z-10"
          >
            <div
              class="absolute left-[15px] top-3.5 w-[9px] h-[9px] rounded-full border-2 border-border bg-background z-20"
            ></div>
            Start editing to see history
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>
