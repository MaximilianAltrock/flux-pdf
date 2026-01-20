<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Clock, Sun, Moon, Trash2, ChevronRight, Info, FilePlus } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { useThemeToggle } from '@/composables/useThemeToggle'
import { formatFileSize, formatTime } from '@/utils/format'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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
  removeSource: [sourceId: string]
  newProject: []
}>()

const { historyList, jumpTo } = props.actions
const { haptic } = useMobile()
const { toggleTheme } = useThemeToggle()

const sources = computed(() => props.state.document.sourceFileList)

const totalSize = computed(() => {
  let size = 0
  for (const source of props.state.document.sources.values()) {
    size += source.fileSize
  }
  return size
})

function handleRemoveSource(sourceId: string) {
  haptic('medium')
  emit('removeSource', sourceId)
}

function handleHistoryJump(pointer: number) {
  haptic('light')
  jumpTo(pointer)
}

function handleNewProject() {
  haptic('medium')
  emit('newProject')
  emit('update:open', false)
}
</script>

<template>
  <Sheet :open="open" @update:open="(val: boolean) => emit('update:open', val)">
    <SheetContent
      side="left"
      class="w-[90vw] max-w-sm p-0 flex flex-col gap-0 border-r border-border bg-card min-h-0"
    >
      <SheetHeader
        class="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border/70 space-y-0 flex-row"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
            <div class="w-4 h-4 bg-primary rounded-sm" />
          </div>
          <SheetTitle class="font-bold text-foreground text-base">FluxPDF</SheetTitle>
        </div>
      </SheetHeader>

      <ScrollArea class="flex-1 min-h-0">
        <div class="flex flex-col">
          <!-- Document Info -->
          <div class="px-4 py-4">
            <div
              class="flex items-center gap-2 ui-kicker mb-3"
            >
              <Info class="w-3.5 h-3.5" />
              <span>Document Info</span>
            </div>
            <div class="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
              <Card class="rounded-lg shadow-none ui-panel-muted py-0">
                <CardContent class="p-3">
                  <div class="text-2xl font-bold text-foreground">
                    {{ props.state.document.pageCount }}
                  </div>
                  <div class="ui-kicker">Pages</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg shadow-none ui-panel-muted py-0">
                <CardContent class="p-3">
                  <div class="text-2xl font-bold text-foreground">{{ sources.length }}</div>
                  <div class="ui-kicker">Files</div>
                </CardContent>
              </Card>
            </div>
            <div class="mt-3 ui-caption">
              Est. size: {{ formatFileSize(totalSize) }}
            </div>
          </div>

          <Separator />

          <!-- Sources Section -->
          <div class="p-4 space-y-3">
            <div class="flex items-center justify-between px-1">
              <div
                class="flex items-center gap-2 ui-kicker"
              >
                <FileText class="w-3.5 h-3.5" />
                <span>Source Files</span>
              </div>
              <Badge variant="secondary" class="h-5">{{ sources.length }}</Badge>
            </div>

            <Empty
              v-if="sources.length === 0"
              class="py-10 ui-panel-muted border-dashed rounded-md"
            >
              <EmptyHeader>
                <EmptyMedia variant="icon" class="mx-auto mb-2 opacity-20">
                  <FilePlus class="w-8 h-8" />
                </EmptyMedia>
                <EmptyTitle class="text-xs">No files loaded</EmptyTitle>
              </EmptyHeader>
            </Empty>

            <ItemGroup v-else class="space-y-2">
              <Item
                v-for="source in sources"
                :key="source.id"
                variant="outline"
                size="sm"
                class="group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-border/60 bg-card/60 px-3 py-2.5 hover:bg-muted/30"
              >
                <ItemMedia variant="icon" class="rounded-md bg-muted/30 border-border/60">
                  <FileText class="w-4 h-4 text-primary" />
                </ItemMedia>
                <ItemContent class="flex-1 min-w-0 py-0 px-0 overflow-hidden">
                  <ItemTitle class="text-sm font-semibold truncate">{{
                    source.filename
                  }}</ItemTitle>
                  <ItemDescription class="text-xs text-muted-foreground mt-0.5">
                    {{ formatFileSize(source.fileSize) }}
                  </ItemDescription>
                </ItemContent>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-10 w-10 justify-self-end text-muted-foreground active:text-destructive active:bg-destructive/10"
                  @click="handleRemoveSource(source.id)"
                  aria-label="Remove source file"
                >
                  <Trash2 class="w-4 h-4" />
                </Button>
              </Item>
            </ItemGroup>
          </div>

          <Separator />

          <!-- History Section -->
          <div class="p-4 space-y-3">
            <div
              class="flex items-center justify-between px-1 ui-kicker"
            >
              <div class="flex items-center gap-2">
                <Clock class="w-3.5 h-3.5" />
                <span>History</span>
              </div>
            </div>

            <Empty
              v-if="historyList.length <= 1"
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
                v-for="cmd in historyList.slice().reverse()"
                :key="cmd.pointer"
                as-child
                variant="outline"
                size="sm"
                :class="[
                  'w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-border/60 px-3 py-2.5 text-left',
                  cmd.isCurrent ? 'border-primary/40 bg-primary/10' : 'hover:bg-muted/30',
                  cmd.isUndone ? 'opacity-60' : '',
                ]"
              >
                <button
                  type="button"
                  @click="handleHistoryJump(cmd.pointer)"
                >
                  <ItemMedia variant="icon" class="rounded-full bg-muted/30 border-border/60">
                    <div class="text-[10px] font-mono opacity-70">
                      <span v-if="cmd.pointer < 0">Start</span>
                      <span v-else>#{{ cmd.pointer + 1 }}</span>
                    </div>
                  </ItemMedia>
                  <ItemContent class="flex-1 text-left min-w-0 py-0 px-0 overflow-hidden">
                    <ItemTitle
                      class="text-sm font-medium truncate"
                      :class="[
                        cmd.isCurrent ? 'text-primary' : 'text-foreground/90',
                        cmd.isUndone
                          ? 'line-through decoration-muted-foreground/40 text-muted-foreground/60'
                          : '',
                      ]"
                    >
                      {{ cmd.command.name }}
                    </ItemTitle>
                    <ItemDescription
                      class="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5"
                    >
                      <Clock class="w-3 h-3" />
                      {{ formatTime(cmd.timestamp) }}
                    </ItemDescription>
                  </ItemContent>
                  <div class="h-10 w-10 flex items-center justify-end justify-self-end">
                    <ChevronRight class="w-4 h-4 text-muted-foreground/40" />
                  </div>
                </button>
              </Item>
            </ItemGroup>
          </div>

          <Separator />

          <!-- Theme Toggle -->
          <div class="px-4 py-4">
            <Button
              variant="outline"
              class="w-full justify-between h-12 px-4"
              @click="toggleTheme"
            >
              <div class="flex items-center gap-3">
                <span class="relative flex h-5 w-5 items-center justify-center">
                  <Sun
                    class="absolute h-5 w-5 text-muted-foreground rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
                  />
                  <Moon
                    class="absolute h-5 w-5 text-muted-foreground rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
                  />
                </span>
                <span class="text-sm">Appearance</span>
              </div>
              <ChevronRight class="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </ScrollArea>

      <div class="p-4 border-t border-border bg-card">
        <Button
          variant="destructive"
          class="w-full gap-3 h-12 text-sm font-semibold"
          @click="handleNewProject"
        >
          <FilePlus class="w-5 h-5" />
          New Project
          <Badge
            variant="outline"
            class="ml-auto text-destructive-foreground/60 border-destructive-foreground/20"
          >
            Clear All
          </Badge>
        </Button>
        <div
          class="mt-4 text-center ui-kicker opacity-70"
        >
          FluxPDF Editor
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

