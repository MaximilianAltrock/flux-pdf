<script setup lang="ts">
import { computed, watch } from 'vue'
import { useScrollLock } from '@vueuse/core'
import { X, FileText, Clock, Sun, Moon, Trash2, ChevronRight, Info } from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { useTheme } from '@/composables/useTheme'
import { useMobile } from '@/composables/useMobile'
import { formatFileSize, formatTime } from '@/utils/format'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  removeSource: [sourceId: string]
}>()

const { onBackButton } = useMobile()

const store = useDocumentStore()
const { historyList, jumpTo } = useCommandManager()
const { isDark, toggleTheme } = useTheme()
const { haptic } = useMobile()

const sources = computed(() => store.sourceFileList)

const totalSize = computed(() => {
  let size = 0
  for (const source of store.sources.values()) {
    size += source.fileSize
  }
  return size
})

function handleThemeToggle() {
  haptic('light')
  toggleTheme()
}

function handleRemoveSource(sourceId: string) {
  haptic('medium')
  emit('removeSource', sourceId)
}

function handleHistoryJump(index: number) {
  haptic('light')
  jumpTo(index)
}

// LOCK THE BODY SCROLL
const isLocked = useScrollLock(document.body)

watch(
  () => props.open,
  (isOpen) => {
    isLocked.value = isOpen
  },
  { immediate: true },
)

onBackButton(
  computed(() => props.open),
  () => emit('close'),
)
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="fixed inset-0 z-50">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="emit('close')" />

        <!-- Drawer -->
        <div
          class="absolute top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-surface flex flex-col pt-[env(safe-area-inset-top)]"
        >
          <!-- Header -->
          <div class="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <div class="w-4 h-4 bg-primary rounded-sm" />
              </div>
              <span class="font-bold text-text">FluxPDF</span>
            </div>
            <button class="p-2 -mr-2 text-text-muted active:text-text" @click="emit('close')">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto">
            <!-- Document Info -->
            <div class="px-4 py-4 border-b border-border">
              <div class="flex items-center gap-2 text-sm text-text-muted mb-3">
                <Info class="w-4 h-4" />
                <span>Document Info</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-background rounded-lg p-3">
                  <div class="text-2xl font-bold text-text">{{ store.pageCount }}</div>
                  <div class="text-xs text-text-muted">Pages</div>
                </div>
                <div class="bg-background rounded-lg p-3">
                  <div class="text-2xl font-bold text-text">{{ sources.length }}</div>
                  <div class="text-xs text-text-muted">Files</div>
                </div>
              </div>
              <div class="mt-3 text-xs text-text-muted">
                Est. size: {{ formatFileSize(totalSize) }}
              </div>
            </div>

            <!-- Source Files -->
            <div class="px-4 py-4 border-b border-border">
              <div class="flex items-center gap-2 text-sm text-text-muted mb-3">
                <FileText class="w-4 h-4" />
                <span>Source Files</span>
              </div>

              <div v-if="sources.length === 0" class="text-sm text-text-muted py-4 text-center">
                No files loaded
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="source in sources"
                  :key="source.id"
                  class="flex items-center gap-3 p-3 bg-background rounded-lg group"
                >
                  <div
                    class="w-1 h-10 rounded-full shrink-0"
                    :style="{ backgroundColor: source.color }"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-text font-medium truncate">
                      {{ source.filename }}
                    </div>
                    <div class="text-xs text-text-muted">
                      {{ source.pageCount }} pages • {{ formatFileSize(source.fileSize) }}
                    </div>
                  </div>
                  <button
                    class="p-2 text-text-muted active:text-danger shrink-0"
                    @click="handleRemoveSource(source.id)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- History -->
            <div class="px-4 py-4 border-b border-border">
              <div class="flex items-center gap-2 text-sm text-text-muted mb-3">
                <Clock class="w-4 h-4" />
                <span>History</span>
              </div>

              <div class="space-y-1 max-h-[200px] overflow-y-auto">
                <button
                  v-for="(entry, index) in historyList.slice().reverse()"
                  :key="index"
                  class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                  :class="entry.isCurrent ? 'bg-primary/10' : 'active:bg-muted/10'"
                  @click="handleHistoryJump(historyList.length - 1 - index)"
                >
                  <div
                    class="w-2 h-2 rounded-full shrink-0"
                    :class="entry.isCurrent ? 'bg-primary' : 'bg-border'"
                  />
                  <span
                    class="flex-1 text-sm truncate"
                    :class="[
                      entry.isCurrent ? 'text-primary font-medium' : 'text-text',
                      entry.isUndone ? 'opacity-50' : '',
                    ]"
                  >
                    {{ entry.command.name }}
                  </span>
                  <span class="text-[10px] text-text-muted font-mono">
                    {{ formatTime(entry.timestamp) }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Theme Toggle -->
            <div class="px-4 py-4">
              <button
                class="w-full flex items-center justify-between p-4 bg-background rounded-lg active:bg-muted/20 transition-colors"
                @click="handleThemeToggle"
              >
                <div class="flex items-center gap-3">
                  <component :is="isDark ? Moon : Sun" class="w-5 h-5 text-text-muted" />
                  <span class="text-sm text-text">
                    {{ isDark ? 'Dark Mode' : 'Light Mode' }}
                  </span>
                </div>
                <ChevronRight class="w-4 h-4 text-text-muted" />
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="px-4 py-3 border-t border-border text-center text-xs text-text-muted"
            style="padding-bottom: max(12px, env(safe-area-inset-bottom, 0px))"
          >
            FluxPDF • PDF Editor
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active > div:last-child {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-leave-active > div:last-child {
  transition: transform 0.2s ease-in;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from > div:last-child,
.drawer-leave-to > div:last-child {
  transform: translateX(-100%);
}
</style>
