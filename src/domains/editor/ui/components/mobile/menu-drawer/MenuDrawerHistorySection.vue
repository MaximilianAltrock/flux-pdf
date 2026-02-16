<script setup lang="ts">
import { ChevronRight, Clock } from 'lucide-vue-next'
import { formatTime } from '@/shared/utils/format'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/shared/components/ui/item'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/components/ui/empty'
import type { HistoryDisplayEntry } from '@/domains/history/domain/commands'

const props = defineProps<{
  historyList: ReadonlyArray<HistoryDisplayEntry>
}>()

const emit = defineEmits<{
  jump: [pointer: number]
}>()
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex items-center justify-between px-1 ui-kicker">
      <div class="flex items-center gap-2">
        <Clock class="w-3.5 h-3.5" />
        <span>History</span>
      </div>
    </div>

    <Empty
      v-if="props.historyList.length <= 1"
      class="py-8 ui-panel-muted border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon" class="mx-auto mb-2 opacity-20">
          <Clock class="w-6 h-6" />
        </EmptyMedia>
        <EmptyTitle class="text-xs">No activity yet</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <ItemGroup v-else class="space-y-2">
      <Item
        v-for="entry in props.historyList.slice().reverse()"
        :key="entry.pointer"
        as-child
        variant="outline"
        size="sm"
        :class="[
          'w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-border/60 px-3 py-2.5 text-left',
          entry.isCurrent ? 'border-primary/40 bg-primary/10' : 'hover:bg-muted/30',
          entry.isUndone ? 'opacity-60' : '',
        ]"
      >
        <button type="button" @click="emit('jump', entry.pointer)">
          <ItemMedia variant="icon" class="rounded-full bg-muted/30 border-border/60">
            <div class="ui-2xs font-mono opacity-70">
              <span v-if="entry.pointer < 0">Start</span>
              <span v-else>#{{ entry.pointer + 1 }}</span>
            </div>
          </ItemMedia>
          <ItemContent class="flex-1 text-left min-w-0 py-0 px-0 overflow-hidden">
            <ItemTitle
              class="text-sm font-medium truncate"
              :class="[
                entry.isCurrent ? 'text-primary' : 'text-foreground/90',
                entry.isUndone
                  ? 'line-through decoration-muted-foreground/40 text-muted-foreground/60'
                  : '',
              ]"
            >
              {{ entry.command.name }}
            </ItemTitle>
            <ItemDescription class="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Clock class="w-3 h-3" />
              {{ formatTime(entry.timestamp) }}
            </ItemDescription>
          </ItemContent>
          <div class="h-10 w-10 flex items-center justify-end justify-self-end">
            <ChevronRight class="w-4 h-4 text-muted-foreground/40" />
          </div>
        </button>
      </Item>
    </ItemGroup>
  </div>
</template>
