<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useScrollLock, useSwipe } from '@vueuse/core'
import { Camera, FolderOpen, X } from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { useMobile } from '@/composables/useMobile'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  selectFiles: [insertAtEnd: boolean]
  takePhoto: []
}>()

const store = useDocumentStore()
const { onBackButton } = useMobile()
const { haptic } = useMobile()

const insertAtEnd = ref(true)
const hasExistingPages = computed(() => store.pageCount > 0)

// 1. LOCK BODY SCROLL
const isLocked = useScrollLock(document.body)

watch(
  () => props.open,
  (isOpen) => {
    isLocked.value = isOpen
  },
  { immediate: true },
)

// 2. SWIPE LOGIC (VueUse)
const sheetRef = ref<HTMLElement | null>(null)

const { lengthY, isSwiping } = useSwipe(sheetRef, {
  passive: false, // Prevent native scrolling while dragging
  onSwipeEnd(e, direction) {
    // If dragged down more than 100px, close
    if (lengthY.value < -100) {
      emit('close')
    }
  },
})

// Calculate animation offset
const dragOffset = computed(() => {
  if (!isSwiping.value) return 0
  // Convert negative lengthY (down drag) to positive translate pixels
  return Math.max(0, -lengthY.value)
})

function handleSelectFiles(atEnd: boolean) {
  haptic('light')
  insertAtEnd.value = atEnd
  emit('selectFiles', atEnd)
  emit('close')
}

function handleTakePhoto() {
  haptic('light')
  emit('takePhoto')
  emit('close')
}

onBackButton(
  computed(() => props.open),
  () => emit('close'),
)
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="emit('close')" />

        <!-- Sheet Container -->
        <div
          ref="sheetRef"
          class="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl overflow-hidden touch-none"
          :style="{ transform: `translateY(${dragOffset}px)` }"
        >
          <!-- Drag Handle -->
          <div class="flex justify-center py-3 pointer-events-none">
            <div class="w-10 h-1 bg-text-muted/30 rounded-full" />
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between px-4 pb-2">
            <h2 class="text-lg font-semibold text-text">Add Pages</h2>
            <button class="p-2 -mr-2 text-text-muted active:text-text" @click="emit('close')">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Options -->
          <div class="px-4 py-4 space-y-3">
            <!-- Browse Files -->
            <button
              class="w-full flex items-center gap-4 p-4 bg-background rounded-xl active:bg-muted/20 transition-colors"
              @click="handleSelectFiles(true)"
            >
              <div
                class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
              >
                <FolderOpen class="w-6 h-6 text-primary" />
              </div>
              <div class="flex-1 text-left">
                <div class="font-medium text-text">Browse Files</div>
                <div class="text-sm text-text-muted">Select PDF or images</div>
              </div>
            </button>

            <!-- Camera (for scanning) -->
            <button
              class="w-full flex items-center gap-4 p-4 bg-background rounded-xl active:bg-muted/20 transition-colors"
              @click="handleTakePhoto"
            >
              <div
                class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
              >
                <Camera class="w-6 h-6 text-primary" />
              </div>
              <div class="flex-1 text-left">
                <div class="font-medium text-text">Take Photo</div>
                <div class="text-sm text-text-muted">Scan a document</div>
              </div>
            </button>
          </div>

          <!-- Insert Position (only show if pages exist) -->
          <div v-if="hasExistingPages" class="px-4 pb-4">
            <div class="text-xs text-text-muted uppercase font-medium mb-2 px-1">
              Insert Position
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                :class="
                  insertAtEnd
                    ? 'bg-primary text-white'
                    : 'bg-background text-text active:bg-muted/20'
                "
                @click="insertAtEnd = true"
              >
                At End
              </button>
              <button
                class="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                :class="
                  !insertAtEnd
                    ? 'bg-primary text-white'
                    : 'bg-background text-text active:bg-muted/20'
                "
                @click="insertAtEnd = false"
              >
                At Start
              </button>
            </div>
            <p class="text-xs text-text-muted mt-2 px-1">
              Or long-press a gap in the grid to insert there
            </p>
          </div>

          <!-- Safe Area -->
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Critical: Stops browser from handling swipes */
.touch-none {
  touch-action: none;
}

.sheet-enter-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-active > div:last-child {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-leave-active > div:last-child {
  transition: transform 0.2s ease-in;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from > div:last-child,
.sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
