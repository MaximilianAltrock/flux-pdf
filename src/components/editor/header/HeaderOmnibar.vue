<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { Spinner } from '@/components/ui/spinner'
import { Kbd } from '@/components/ui/kbd'
import { useUiStore } from '@/stores/ui'
import { withPrimaryModifier } from '@/utils/shortcuts'

const ui = useUiStore()
const commandPaletteShortcut = withPrimaryModifier('K')

defineEmits<{
  command: []
}>()
</script>

<template>
  <div class="flex-1 flex justify-center">
    <div class="relative w-96 max-w-full">
      <!-- Progress Bar (Subtle Scanline) -->
      <div
        v-if="ui.isLoading"
        class="absolute inset-x-0 bottom-0 h-[2px] bg-primary/20 overflow-hidden rounded-b-md"
      >
        <div class="h-full bg-primary w-1/3 animate-shimmer"></div>
      </div>

      <button
        @click="$emit('command')"
        :disabled="ui.isLoading"
        class="w-full h-8 bg-card border border-border rounded-sm flex items-center px-3 gap-2 transition-colors group cursor-text hover:bg-muted/20 disabled:cursor-wait disabled:opacity-70"
        :class="{ 'ring-1 ring-primary/20 border-primary/40': ui.isLoading }"
      >
        <div class="flex items-center justify-center w-4 h-4 shrink-0">
          <Spinner v-if="ui.isLoading" class="w-3.5 h-3.5 text-primary" />
          <Search
            v-else
            class="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary/70 transition-colors"
          />
        </div>

        <span
          class="text-xs truncate min-w-0 flex-1 text-left"
          :class="
            ui.isLoading
              ? 'text-primary/90 font-medium'
              : 'text-muted-foreground group-hover:text-foreground'
          "
        >
          {{
            ui.isLoading
              ? ui.loadingMessage || 'Processing...'
              : 'Search commands...'
          }}
        </span>

        <div
          v-if="!ui.isLoading"
          class="ml-auto shrink-0 flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity"
        >
          <Kbd
            class="hidden sm:inline-flex ui-mono ui-2xs"
          >
            {{ commandPaletteShortcut }}
          </Kbd>
        </div>
      </button>
    </div>
  </div>
</template>
