<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

const styles = {
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
    message: 'text-green-700'
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    message: 'text-red-700'
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
    message: 'text-amber-700'
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
    message: 'text-blue-700'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto w-80 border rounded-lg shadow-lg overflow-hidden"
          :class="styles[toast.type].bg"
        >
          <div class="flex items-start gap-3 p-4">
            <!-- Icon -->
            <component
              :is="icons[toast.type]"
              class="w-5 h-5 flex-shrink-0 mt-0.5"
              :class="styles[toast.type].icon"
            />
            
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p 
                class="text-sm font-medium"
                :class="styles[toast.type].title"
              >
                {{ toast.title }}
              </p>
              <p 
                v-if="toast.message"
                class="text-sm mt-1"
                :class="styles[toast.type].message"
              >
                {{ toast.message }}
              </p>
            </div>
            
            <!-- Dismiss button -->
            <button
              v-if="toast.dismissible"
              class="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
              @click="dismiss(toast.id)"
            >
              <X class="w-4 h-4" :class="styles[toast.type].icon" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.2s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
