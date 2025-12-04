<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import { AlertTriangle, Info, Trash2 } from 'lucide-vue-next'

const { isOpen, state, handleConfirm, handleCancel } = useConfirm()

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
      iconBg: 'bg-amber-100',
      icon: 'text-amber-600',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    info: {
      iconBg: 'bg-blue-100',
      icon: 'text-blue-600',
      confirmBtn: 'bg-flux-600 hover:bg-flux-700 text-white'
    }
  }[variant]
})

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return
  
  if (event.key === 'Escape') {
    handleCancel()
  } else if (event.key === 'Enter') {
    handleConfirm()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="isOpen && state" 
        class="fixed inset-0 z-[90] flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/50"
          @click="handleCancel"
        />
        
        <!-- Dialog -->
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
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
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ state.title }}
                </h3>
                <p class="mt-2 text-sm text-gray-600">
                  {{ state.message }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              @click="handleCancel"
            >
              {{ state.cancelText }}
            </button>
            <button
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
