<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { Spinner } from '@/components/ui/spinner'
import { Kbd } from '@/components/ui/kbd'
import type { FacadeState } from '@/composables/useDocumentFacade'

defineProps<{
  state: FacadeState
}>()

defineEmits<{
  command: []
}>()
</script>

<template>
  <div class="flex-1 flex justify-center">
    <div class="relative w-[400px]">
      <!-- Progress Bar (Background) -->
      <div
        v-if="state.isLoading.value"
        class="absolute inset-0 bg-primary/5 rounded overflow-hidden"
      >
        <div class="h-full bg-primary/10 w-full animate-pulse origin-left"></div>
      </div>

      <button
        @click="$emit('command')"
        :disabled="state.isLoading.value"
        class="w-full h-[32px] bg-muted border border-border hover:border-primary/50 rounded-md flex items-center px-3 gap-2 transition-all group cursor-text disabled:cursor-wait disabled:opacity-80"
        :class="{ 'border-primary/30': state.isLoading.value }"
      >
        <Spinner v-if="state.isLoading.value" class="w-3.5 h-3.5 text-primary shrink-0" />
        <Search
          v-else
          class="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
        />

        <span
          class="text-xs truncate min-w-0 flex-1 text-left"
          :class="
            state.isLoading.value
              ? 'text-primary font-medium'
              : 'text-muted-foreground group-hover:text-foreground'
          "
        >
          {{
            state.isLoading.value
              ? state.loadingMessage.value || 'Processing...'
              : 'Search commands...'
          }}
        </span>

        <div v-if="!state.isLoading.value" class="ml-auto shrink-0 flex items-center gap-1.5">
          <Kbd
            class="hidden sm:inline-flex rounded bg-background border border-border font-mono text-xxs text-muted-foreground whitespace-nowrap"
          >
            ⌘K
          </Kbd>
        </div>
      </button>
    </div>
  </div>
</template>
