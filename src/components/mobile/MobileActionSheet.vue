<script setup lang="ts">
import { computed } from 'vue'
import { useMobileActionRegistry } from '@/composables/useMobileActionRegistry'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  open: boolean
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { groupedSecondaryActions } = useMobileActionRegistry(props.actions)

const selectedCount = computed(() => props.state.document.selectedCount)

function handleActionTap(action: { execute: () => void; disabled?: boolean }) {
  if (action.disabled) return
  action.execute()
  emit('update:open', false)
}

function handleClose() {
  emit('update:open', false)
}
</script>

<template>
  <Drawer :open="open" @update:open="(val) => emit('update:open', val)">
    <DrawerContent>
      <div class="mx-auto w-full max-w-sm">
        <DrawerHeader>
          <DrawerTitle class="text-center ui-caption">
            {{ selectedCount }} page{{ selectedCount > 1 ? 's' : '' }} selected
          </DrawerTitle>
        </DrawerHeader>

        <!-- Grouped Actions -->
        <div class="px-4 pb-4 space-y-4">
          <div v-for="group in groupedSecondaryActions" :key="group.category">
            <!-- Category label -->
            <p
              class="ui-kicker mb-2 px-1"
            >
              {{ group.label }}
            </p>

            <!-- Actions in group -->
            <div class="ui-panel-muted rounded-lg overflow-hidden">
              <Button
                v-for="(action, index) in group.actions"
                :key="action.id"
                variant="ghost"
                :disabled="action.disabled"
                class="w-full h-12 justify-start gap-3 rounded-none px-4 text-foreground hover:bg-muted/20 active:bg-muted/30 transition-colors"
                :class="{
                  'opacity-50': action.disabled,
                  'border-t border-border': index > 0,
                }"
                @click="handleActionTap(action)"
              >
                <component :is="action.icon" class="w-5 h-5 text-muted-foreground" />
                <span class="text-sm font-medium">{{ action.label }}</span>
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <!-- Cancel button -->
        <div class="px-4 py-4">
          <Button variant="outline" class="w-full h-12 font-semibold" @click="handleClose">
            Cancel
          </Button>
        </div>

        <DrawerFooter class="pt-0">
          <!-- Safe Area -->
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>
