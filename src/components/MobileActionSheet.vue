<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useScrollLock, useSwipe } from '@vueuse/core'
import { RotateCw, RotateCcw, Copy, Trash2, Download, X } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps<{
  open: boolean
  selectedCount: number
}>()

const emit = defineEmits<{
  close: []
  rotateLeft: []
  rotateRight: []
  duplicate: []
  delete: []
  exportSelected: []
}>()

const { onBackButton } = useMobile()

const { haptic } = useMobile()

// 1. LOCK BODY SCROLL
// Prevents the background grid from moving while sheet is open
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
const closeButtonRef = ref<HTMLButtonElement | null>(null)

const { lengthY, isSwiping } = useSwipe(sheetRef, {
  // passive: false allows us to prevent native browser scrolling while dragging
  passive: false,
  onSwipeEnd() {
    // lengthY is negative when dragging DOWN (Start Y - End Y)
    // If dragged down more than 100px, close
    if (lengthY.value < -100) {
      emit('close')
    }
  },
})

// Calculate transform for the animation
const dragOffset = computed(() => {
  // Snap back to 0 if not currently swiping
  if (!isSwiping.value) return 0
  // Convert negative lengthY to positive translate pixels
  // Math.max(0) ensures we can't drag it UPWARDS past the start
  return Math.max(0, -lengthY.value)
})

type ActionSheetEvent = 'rotateLeft' | 'rotateRight' | 'duplicate' | 'delete' | 'exportSelected'

function handleAction(action: ActionSheetEvent) {
  haptic('medium')

  switch (action) {
    case 'rotateLeft':
      emit('rotateLeft')
      break
    case 'rotateRight':
      emit('rotateRight')
      break
    case 'duplicate':
      emit('duplicate')
      break
    case 'delete':
      emit('delete')
      break
    case 'exportSelected':
      emit('exportSelected')
      break
  }

  emit('close')
}

onBackButton(
  computed(() => props.open),
  () => emit('close'),
)

useFocusTrap(
  computed(() => props.open),
  sheetRef,
  {
    onEscape: () => emit('close'),
    initialFocus: () => closeButtonRef.value,
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="emit('close')" />

        <!-- Sheet Container -->
        <!--
             1. ref="sheetRef" binds VueUse logic
             2. class="touch-none" prevents browser gestures
        -->
        <div
          ref="sheetRef"
          class="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl overflow-hidden touch-none"
          :style="{ transform: `translateY(${dragOffset}px)` }"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-actions-title"
        >
          <!-- Drag Handle -->
          <div class="flex justify-center py-3 pointer-events-none">
            <div class="w-10 h-1 bg-text-muted/30 rounded-full" />
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between px-4 pb-2">
            <h2 id="mobile-actions-title" class="text-lg font-semibold text-text">
              {{ selectedCount }} page{{ selectedCount > 1 ? 's' : '' }} selected
            </h2>
            <button
              ref="closeButtonRef"
              type="button"
              aria-label="Close actions"
              class="p-2 -mr-2 text-text-muted active:text-text"
              @click="emit('close')"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Actions Grid -->
          <div class="grid grid-cols-4 gap-2 px-4 py-4">
            <button
              type="button"
              class="flex flex-col items-center gap-2 p-3 rounded-xl bg-background active:bg-muted/20 transition-colors"
              @click="handleAction('rotateLeft')"
            >
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <RotateCcw class="w-5 h-5 text-primary" />
              </div>
              <span class="text-xs text-text">Left</span>
            </button>

            <button
              type="button"
              class="flex flex-col items-center gap-2 p-3 rounded-xl bg-background active:bg-muted/20 transition-colors"
              @click="handleAction('rotateRight')"
            >
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <RotateCw class="w-5 h-5 text-primary" />
              </div>
              <span class="text-xs text-text">Right</span>
            </button>

            <button
              type="button"
              class="flex flex-col items-center gap-2 p-3 rounded-xl bg-background active:bg-muted/20 transition-colors"
              @click="handleAction('duplicate')"
            >
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Copy class="w-5 h-5 text-primary" />
              </div>
              <span class="text-xs text-text">Copy</span>
            </button>

            <button
              type="button"
              class="flex flex-col items-center gap-2 p-3 rounded-xl bg-background active:bg-muted/20 transition-colors"
              @click="handleAction('exportSelected')"
            >
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Download class="w-5 h-5 text-primary" />
              </div>
              <span class="text-xs text-text">Export</span>
            </button>
          </div>

          <!-- Delete (separate, danger) -->
          <div class="px-4 pb-4">
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 py-3.5 bg-danger/10 text-danger rounded-xl font-medium active:bg-danger/20 transition-colors"
              @click="handleAction('delete')"
            >
              <Trash2 class="w-5 h-5" />
              <span>Delete {{ selectedCount > 1 ? 'Pages' : 'Page' }}</span>
            </button>
          </div>

          <!-- Safe Area -->
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Critical: Stops browser from handling swipes (scrolling background) */
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
