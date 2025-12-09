<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { Check, Trash2, AlertTriangle, RefreshCw, X } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()

// Icons per type
const icons = {
  success: Check,
  destructive: Trash2,
  warning: AlertTriangle,
  info: RefreshCw,
}

// Colors per type (from spec)
// These define the Status Strip and Icon colors.
// We keep them as hex/specific values to maintain Semantic meaning across themes.
const typeStyles = {
  success: {
    strip: '#10B981', // Neon Green
    icon: 'text-[#10B981]',
    action: 'text-[#10B981] hover:text-[#34D399]',
  },
  destructive: {
    strip: '#F43F5E', // Muted Coral
    icon: 'text-[#F43F5E]',
    action: 'text-[#F43F5E] hover:text-[#FB7185]',
  },
  warning: {
    strip: '#F59E0B', // Amber
    icon: 'text-[#F59E0B]',
    action: 'text-[#F59E0B] hover:text-[#FBBF24]',
  },
  info: {
    strip: '#6366F1', // Electric Indigo
    icon: 'text-[#6366F1]',
    action: 'text-[#6366F1] hover:text-[#818CF8]',
  },
}

// Swipe to dismiss logic
const swipeStates = ref<Map<string, { startX: number; currentX: number; swiping: boolean }>>(
  new Map(),
)

function handleTouchStart(id: string, event: TouchEvent) {
  const touch = event.touches[0]
  if (touch) {
    swipeStates.value.set(id, {
      startX: touch.clientX,
      currentX: touch.clientX,
      swiping: false,
    })
  }
}

function handleTouchMove(id: string, event: TouchEvent) {
  const state = swipeStates.value.get(id)
  const touch = event.touches[0]
  if (state && touch) {
    const deltaX = touch.clientX - state.startX
    // Only allow swiping right (positive delta)
    if (deltaX > 10) {
      state.swiping = true
      state.currentX = touch.clientX
    }
  }
}

function handleTouchEnd(id: string) {
  const state = swipeStates.value.get(id)
  if (state && state.swiping) {
    const deltaX = state.currentX - state.startX
    // If swiped more than 100px, dismiss
    if (deltaX > 100) {
      dismiss(id)
    }
  }
  swipeStates.value.delete(id)
}

function getSwipeTransform(id: string): string {
  const state = swipeStates.value.get(id)
  if (state && state.swiping) {
    const deltaX = Math.max(0, state.currentX - state.startX)
    return `translateX(${deltaX}px)`
  }
  return ''
}

function getSwipeOpacity(id: string): number {
  const state = swipeStates.value.get(id)
  if (state && state.swiping) {
    const deltaX = Math.max(0, state.currentX - state.startX)
    return Math.max(0, 1 - deltaX / 200)
  }
  return 1
}
</script>

<template>
  <Teleport to="body">
    <!-- Container: Bottom right, 32px from edges -->
    <div
      class="fixed bottom-8 right-8 z-[9999] flex flex-col-reverse gap-3 pointer-events-none max-sm:bottom-4 max-sm:right-4 max-sm:left-4"
      role="region"
      aria-label="Notifications"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-card pointer-events-auto w-80 max-sm:w-full bg-surface border border-border rounded shadow-toast overflow-hidden flex touch-none select-none"
          :role="toast.type === 'warning' ? 'alert' : 'status'"
          :aria-live="toast.type === 'warning' ? 'assertive' : 'polite'"
          :style="{
            transform: getSwipeTransform(toast.id),
            opacity: getSwipeOpacity(toast.id),
          }"
          @touchstart="handleTouchStart(toast.id, $event)"
          @touchmove="handleTouchMove(toast.id, $event)"
          @touchend="handleTouchEnd(toast.id)"
        >
          <!-- Status Strip (4px left edge) -->
          <div class="w-1 shrink-0" :style="{ backgroundColor: typeStyles[toast.type].strip }" />

          <!-- Content -->
          <div class="flex items-start gap-3 p-3 flex-1 min-w-0">
            <!-- Icon -->
            <div class="shrink-0 mt-0.5">
              <component
                :is="icons[toast.type]"
                class="w-4 h-4"
                :class="typeStyles[toast.type].icon"
              />
            </div>

            <!-- Message Body -->
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-text leading-tight">
                {{ toast.title }}
              </p>
              <p
                v-if="toast.detail"
                class="text-[11px] font-mono text-text-muted mt-0.5 truncate"
                :title="toast.detail"
              >
                {{ toast.detail }}
              </p>
            </div>

            <!-- Action Button -->
            <div class="shrink-0 flex items-center gap-1">
              <button
                v-if="toast.action"
                class="text-[11px] font-bold tracking-wide transition-colors px-2 py-1 rounded hover:bg-text/5"
                :class="typeStyles[toast.type].action"
                @click="toast.action.onClick"
              >
                {{ toast.action.label }}
              </button>

              <!-- Dismiss button (for warnings/errors or as fallback) -->
              <button
                v-if="toast.duration === 0 || toast.type === 'warning'"
                class="p-1 rounded hover:bg-text/10 transition-colors"
                :class="typeStyles[toast.type].icon"
                @click="dismiss(toast.id)"
                title="Dismiss"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/* High lift shadow from spec */
.shadow-toast {
  box-shadow: var(--paper-shadow); /* Use theme shadow or fallback */
}

/* Entrance: Slide in from right with spring effect */
.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Exit: Fade out */
.toast-leave-active {
  transition: all 0.2s linear;
}

/* Entrance from */
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

/* Exit to */
.toast-leave-to {
  opacity: 0;
}

/* Smooth repositioning when toasts are added/removed */
.toast-move {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Mobile: slide from bottom */
@media (max-width: 640px) {
  .toast-enter-from {
    transform: translateY(20px);
  }
}

.touch-none {
  touch-action: none;
}
</style>
