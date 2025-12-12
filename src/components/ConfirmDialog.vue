<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import { AlertTriangle, Info, Trash2 } from 'lucide-vue-next'
import { useFocusTrap } from '@/composables/useFocusTrap'

const { isOpen, state, handleConfirm, handleCancel } = useConfirm()

const dialogRef = ref<HTMLElement | null>(null)
const confirmButtonRef = ref<HTMLButtonElement | null>(null)

const icons = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info
}

const styles = computed(() => {
  const variant = state.value?.variant ?? 'info'

  return {
    danger: {
      iconBg: 'bg-red-100',
      icon: 'text-red-600',
      confirmBtn: 'bg-red-600 hover:bg-red-700 text-white'
    },
    warning: {
      iconBg: 'bg-amber-100', // Keep specific warning colors or map to specific override vars if desired, defaulting to raw for alerts usually safer or define --warning
      icon: 'text-amber-600',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    info: {
      iconBg: 'bg-primary/10',
      icon: 'text-primary',
      confirmBtn: 'bg-primary hover:bg-primary/90 text-primary-foreground'
    }
  }[variant]
})

useFocusTrap(isOpen, dialogRef, {
  onEscape: handleCancel,
  initialFocus: () => confirmButtonRef.value,
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen && state"
        class="fixed inset-0 z-[90] flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="handleCancel"
        />

        <!-- Dialog -->
        <div
          ref="dialogRef"
          class="relative bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        >
          <div class="p-6">
            <div class="flex items-start gap-4">
              <!-- Icon -->
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                :class="styles.iconBg"
              >
                <component
                  :is="icons[state.variant ?? 'info']"
                  class="w-5 h-5"
                  :class="styles.icon"
                />
              </div>

              <!-- Content -->
              <div class="flex-1">
                <h3 id="confirm-dialog-title" class="text-lg font-semibold text-text">
                  {{ state.title }}
                </h3>
                <p id="confirm-dialog-description" class="mt-2 text-sm text-text-muted">
                  {{ state.message }}
                </p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 bg-muted/5 border-t border-border">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-text hover:bg-muted/20 rounded-lg transition-colors"
              @click="handleCancel"
            >
              {{ state.cancelText }}
            </button>
            <button
              ref="confirmButtonRef"
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              :class="styles.confirmBtn"
              @click="handleConfirm"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
