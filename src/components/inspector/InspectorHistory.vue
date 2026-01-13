<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Timeline, TimelineItem, TimelineTime, TimelineTitle } from '@/components/ui/timeline'
import { History } from 'lucide-vue-next'
import { formatTime } from '@/utils/format'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()
const { historyList, jumpTo } = props.actions

const historyScrollArea = ref<InstanceType<typeof ScrollArea> | null>(null)

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
    <div class="h-9 px-4 border-b border-border/40 flex items-center justify-between bg-sidebar/50">
      <h2
        class="text-xxs font-bold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-2"
      >
        Session History
        <span class="w-1 h-1 rounded-full bg-primary/40"></span>
      </h2>
      <Badge
        variant="outline"
        class="text-xxs h-4 font-mono opacity-50 p-0 px-1.5 border-none shadow-none text-muted-foreground/40"
        >{{ historyList.length }} steps</Badge
      >
    </div>

    <ScrollArea ref="historyScrollArea" class="flex-1 min-h-0 bg-background/5">
      <div class="py-6 px-4">
        <Timeline v-if="historyList.length > 0" size="sm" variant="history" class="w-full">
          <TimelineItem
            v-for="(entry, index) in historyList"
            :key="index"
            :status="entry.isCurrent ? 'in-progress' : entry.isUndone ? 'pending' : 'completed'"
            :show-connector="index !== historyList.length - 1"
            icon-size="lg"
            class="cursor-pointer group relative mb-6 last:mb-0"
            @click="jumpTo(entry.pointer)"
          >
            <template #title>
              <TimelineTitle
                class="text-xs font-bold truncate transition-colors leading-tight"
                :class="[
                  entry.isCurrent
                    ? 'text-primary'
                    : 'text-foreground/60 group-hover:text-foreground',
                  entry.isUndone
                    ? 'text-muted-foreground/30 italic line-through decoration-muted-foreground/20 font-medium'
                    : '',
                ]"
              >
                {{ entry.command.name }}
              </TimelineTitle>
            </template>
            <template #description>
              <div class="flex items-center gap-2 mt-0.5">
                <TimelineTime
                  class="text-xxs text-muted-foreground/30 font-mono tracking-tighter uppercase"
                >
                  {{ formatTime(entry.timestamp, true) }}
                </TimelineTime>
              </div>
            </template>
          </TimelineItem>
        </Timeline>

        <div
          v-else
          class="h-full flex flex-col items-center justify-center p-8 opacity-20 text-center grayscale"
        >
          <div class="bg-muted rounded-full p-3 mb-2 border border-border">
            <History class="w-5 h-5" />
          </div>
          <p class="text-xxs font-bold uppercase tracking-widest">No Activity</p>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
