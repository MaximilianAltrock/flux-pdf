<script setup lang="ts">
import { computed } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import { AlertTriangle, Info, Trash2 } from 'lucide-vue-next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const { isOpen, state, handleConfirm, handleCancel } = useConfirm()

const icons = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info,
}

const styles = computed(() => {
  if (!state.value) return null
  const variant = state.value.variant ?? 'info'

  return {
    danger: {
      iconBg: 'bg-destructive/10',
      icon: 'text-destructive',
    },
    warning: {
      iconBg: 'bg-amber-100',
      icon: 'text-amber-600',
    },
    info: {
      iconBg: 'bg-primary/10',
      icon: 'text-primary',
    },
  }[variant]
})
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent v-if="state" class="sm:max-w-[425px]">
      <div class="flex items-start gap-4">
        <!-- Icon -->
        <div
          class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          :class="styles?.iconBg"
        >
          <component :is="icons[state.variant ?? 'info']" class="w-5 h-5" :class="styles?.icon" />
        </div>

        <div class="flex-1">
          <AlertDialogHeader>
            <AlertDialogTitle>{{ state.title }}</AlertDialogTitle>
            <AlertDialogDescription class="mt-2 text-muted-foreground">
              {{ state.message }}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
      </div>

      <AlertDialogFooter class="mt-4">
        <AlertDialogCancel @click="handleCancel">
          {{ state.cancelText }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="
            cn(
              state.variant === 'danger' && buttonVariants({ variant: 'destructive' }),
              state.variant === 'warning' && 'bg-amber-600 hover:bg-amber-700 text-white',
            )
          "
          @click="handleConfirm"
        >
          {{ state.confirmText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
