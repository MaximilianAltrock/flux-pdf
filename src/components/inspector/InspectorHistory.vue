<script setup lang="ts">
import { watch, nextTick, useTemplateRef } from 'vue'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Timeline, TimelineItem, TimelineTime, TimelineTitle } from '@/components/ui/timeline'
import { History } from 'lucide-vue-next'
import { formatTime } from '@/utils/format'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'

const { historyList, jumpTo } = useDocumentActionsContext()

const historyScrollArea = useTemplateRef<InstanceType<typeof ScrollArea>>('historyScrollArea')

watch(
  () => historyList.value.length,
  async (newLength, oldLength) => {
    if (newLength > oldLength) {
      await nextTick()
      if (historyScrollArea.value) {
        const viewport = historyScrollArea.value.$el.querySelector(
          '[data-slot="scroll-area-viewport"]',
        )
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth',
          })
        }
      }
    }
  },
)
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <div
      class="h-9 px-4 border-b border-sidebar-border flex items-center justify-between bg-sidebar"
    >
      <h2 class="ui-kicker flex items-center gap-2">
        Session History
        <span class="w-1 h-1 rounded-full bg-primary/40"></span>
      </h2>
      <Badge variant="outline" class="ui-mono ui-2xs h-4 opacity-60 px-1.5"
        >{{ historyList.length }} steps</Badge
      >
    </div>

    <ScrollArea ref="historyScrollArea" class="flex-1 min-h-0 bg-sidebar">
      <div class="py-6 px-4">
        <Timeline v-if="historyList.length > 0" size="sm" variant="history" class="w-full">
          <TimelineItem
            v-for="(entry, index) in historyList"
            :key="entry.pointer"
            :status="entry.isCurrent ? 'in-progress' : entry.isUndone ? 'pending' : 'completed'"
            :show-connector="index !== historyList.length - 1"
            icon-size="lg"
            class="cursor-pointer group relative mb-6 last:mb-0 rounded-sm focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none"
            @click="jumpTo(entry.pointer)"
            @keydown.enter.prevent="jumpTo(entry.pointer)"
            @keydown.space.prevent="jumpTo(entry.pointer)"
            role="button"
            tabindex="0"
            :aria-label="`Jump to ${entry.command.name}`"
          >
            <template #title>
              <TimelineTitle
                class="ui-label truncate transition-colors leading-tight"
                :class="[
                  entry.isCurrent
                    ? 'text-primary'
                    : 'text-foreground/80 group-hover:text-foreground',
                  entry.isUndone
                    ? 'text-muted-foreground/40 italic line-through decoration-muted-foreground/20'
                    : '',
                ]"
              >
                {{ entry.command.name }}
              </TimelineTitle>
            </template>
            <template #description>
              <div class="flex items-center gap-2 mt-0.5">
                <TimelineTime class="ui-caption ui-mono uppercase tracking-[0.2em]">
                  {{ formatTime(entry.timestamp, true) }}
                </TimelineTime>
              </div>
            </template>
          </TimelineItem>
        </Timeline>

        <div v-else class="h-full flex flex-col items-center justify-center p-8 text-center">
          <div class="ui-panel-muted rounded-md p-3 mb-2">
            <History class="w-5 h-5" />
          </div>
          <p class="ui-kicker opacity-70">No Activity</p>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
