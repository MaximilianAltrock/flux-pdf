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
    bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800', // Success usually keeps green
    icon: 'text-green-500 dark:text-green-400',
    title: 'text-green-800 dark:text-green-200',
    message: 'text-green-700 dark:text-green-300'
  },
  error: {
    bg: 'bg-danger/10 border-danger/20',
    icon: 'text-danger',
    title: 'text-danger',
    message: 'text-danger/80'
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800', // Warning usually keeps amber
    icon: 'text-amber-500 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-200',
    message: 'text-amber-700 dark:text-amber-300'
  },
  info: {
    bg: 'bg-surface border-border',
    icon: 'text-primary',
    title: 'text-text',
    message: 'text-text-muted'
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
          class="pointer-events-auto w-80 border rounded-lg shadow-lg overflow-hidden bg-surface"
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
              class="flex-shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
