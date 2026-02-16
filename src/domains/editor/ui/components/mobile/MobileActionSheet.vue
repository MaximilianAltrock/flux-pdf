<script setup lang="ts">
import { computed } from 'vue'
import { useMobileActionRegistry } from '@/domains/editor/application/useMobileActionRegistry'
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
} from '@/shared/components/ui/drawer'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'
import MobileDrawerHeader from '@/domains/editor/ui/components/mobile/MobileDrawerHeader.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()
const { groupedSecondaryActions } = useMobileActionRegistry(actions)

const selectedCount = computed(() => document.selectedCount)

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
        <MobileDrawerHeader
          :title="`${selectedCount} page${selectedCount > 1 ? 's' : ''} selected`"
          description="Choose actions to apply to the selected pages."
          title-class="text-center ui-caption"
        />

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

