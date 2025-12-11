<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useScrollLock, useSwipe } from '@vueuse/core'
import { X } from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { useMobile } from '@/composables/useMobile'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useDocumentStore()
const { onBackButton } = useMobile()
const { haptic } = useMobile()

const inputRef = ref<HTMLInputElement | null>(null)
const editedTitle = ref('')

// 1. LOCK BODY SCROLL
const isLocked = useScrollLock(document.body)

// 2. SWIPE LOGIC (VueUse)
const sheetRef = ref<HTMLElement | null>(null)

const { lengthY, isSwiping } = useSwipe(sheetRef, {
  passive: false, // Prevent native scrolling while dragging
  onSwipeEnd() {
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

// 3. WATCHERS (Focus & Scroll Lock)
watch(
  () => props.open,
  async (isOpen) => {
    // Update lock state
    isLocked.value = isOpen

    if (isOpen) {
      editedTitle.value = store.projectTitle
      await nextTick()
      // Small delay to let the sheet animate in
      setTimeout(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      }, 100)
    }
  },
  { immediate: true }, // Ensure lock is set on mount if open
)

function handleSave() {
  const trimmed = editedTitle.value.trim().replace(/[\/\\:]/g, '-')
  if (trimmed) {
    store.projectTitle = trimmed
    haptic('light')
  }
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault() // Prevent form submission if inside form
    handleSave()
  }
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
          <div class="flex items-center justify-between px-4 pb-3">
            <h2 class="text-lg font-semibold text-text">Rename Project</h2>
            <button class="p-2 -mr-2 text-text-muted active:text-text" @click="emit('close')">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="px-4 pb-4">
            <input
              ref="inputRef"
              v-model="editedTitle"
              type="text"
              placeholder="Enter project name"
              class="w-full px-4 py-3 bg-background border border-border rounded-xl text-text text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              @keydown="handleKeydown"
            />
            <p class="mt-2 text-xs text-text-muted px-1">
              This will be the filename when you export
            </p>
          </div>

          <!-- Actions -->
          <div class="px-4 pb-4">
            <button
              class="w-full py-3.5 bg-primary text-white rounded-xl font-semibold active:bg-primary/90 transition-colors"
              @click="handleSave"
            >
              Save
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
