<script setup lang="ts">
import { computed } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import { AlertTriangle, Info, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
    },
    warning: {
      iconBg: 'bg-amber-100',
      icon: 'text-amber-600',
    },
    info: {
      iconBg: 'bg-primary/10',
      icon: 'text-primary',
    }
  }[variant]
})

function onOpenChange(val: boolean) {
  if (!val) {
    handleCancel()
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="onOpenChange">
    <DialogContent v-if="state" class="sm:max-w-[425px]">
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

        <div class="flex-1">
          <DialogHeader>
            <DialogTitle>{{ state.title }}</DialogTitle>
            <DialogDescription class="mt-2">
              {{ state.message }}
            </DialogDescription>
          </DialogHeader>
        </div>
      </div>

      <DialogFooter class="mt-4">
        <Button variant="ghost" @click="handleCancel">
          {{ state.cancelText }}
        </Button>
        <Button
          :variant="state.variant === 'danger' ? 'destructive' : state.variant === 'warning' ? 'default' : 'default'"
          :class="state.variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : ''"
          @click="handleConfirm"
        >
          {{ state.confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
