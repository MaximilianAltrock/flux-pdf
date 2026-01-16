<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Clock, Sun, Moon, Trash2, ChevronRight, Info, FilePlus } from 'lucide-vue-next'
import { useColorMode } from '@vueuse/core'
import { useMobile } from '@/composables/useMobile'
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
const mode = useColorMode()

const toggleTheme = (event: MouseEvent) => {
  const { clientX: x, clientY: y } = event
  const newMode = mode.value === 'dark' ? 'light' : 'dark'

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!document.startViewTransition || prefersReducedMotion) {
    mode.value = newMode
    return
  }

  document.documentElement.style.setProperty('--x', `${x}px`)
  document.documentElement.style.setProperty('--y', `${y}px`)

  document.startViewTransition(() => {
    mode.value = newMode
  })
}

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
      class="w-[85%] max-w-[320px] p-0 flex flex-col gap-0 border-r border-border bg-card"
    >
      <SheetHeader
        class="h-14 flex items-center justify-between px-4 border-b border-border space-y-0 flex-row"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
            <div class="w-4 h-4 bg-primary rounded-sm" />
          </div>
          <SheetTitle class="font-bold text-foreground text-base">FluxPDF</SheetTitle>
        </div>
      </SheetHeader>

      <ScrollArea class="flex-1">
        <div class="flex flex-col">
          <!-- Document Info -->
          <div class="px-4 py-4">
            <div
              class="flex items-center gap-2 ui-kicker mb-3"
            >
              <Info class="w-3.5 h-3.5" />
              <span>Document Info</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <Card class="rounded-md shadow-none">
                <CardContent class="p-3">
                  <div class="text-2xl font-bold text-foreground">
                    {{ props.state.document.pageCount }}
                  </div>
                  <div class="ui-kicker">Pages</div>
                </CardContent>
              </Card>
              <Card class="rounded-md shadow-none">
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
              class="py-10 border border-dashed rounded-md bg-muted/10"
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
                class="group relative overflow-hidden pr-0"
              >
                <ItemMedia variant="icon" class="ml-4 mr-0">
                  <FileText class="w-5 h-5 text-primary" />
                </ItemMedia>
                <ItemContent class="flex-1 py-3 px-4 min-w-0">
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
                  class="h-12 w-12 text-muted-foreground active:text-destructive active:bg-destructive/10"
                  @click="handleRemoveSource(source.id)"
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
              v-if="historyList.length === 0"
              class="py-8 border border-dashed rounded-md bg-muted/10 flex flex-col items-center justify-center text-muted-foreground"
            >
              <EmptyHeader>
                <EmptyMedia variant="icon" class="mx-auto mb-2 opacity-20">
                  <Clock class="w-6 h-6" />
                </EmptyMedia>
                <EmptyTitle class="text-xs">No activity yet</EmptyTitle>
              </EmptyHeader>
            </Empty>

            <ItemGroup v-else class="space-y-1">
              <Item
                v-for="(cmd, idx) in historyList.slice().reverse()"
                :key="idx"
                as-child
                variant="outline"
                size="sm"
                class="w-full p-0"
              >
                <button
                  @click="handleHistoryJump(historyList.length - 1 - idx)"
                  class="flex items-center w-full"
                >
                  <ItemMedia variant="icon" class="ml-3 mr-0 w-8 h-8 rounded-full bg-muted/30">
                    <div class="text-xs font-mono opacity-50">
                      {{ historyList.length - idx }}
                    </div>
                  </ItemMedia>
                  <ItemContent class="flex-1 text-left min-w-0 py-2.5 px-3">
                    <ItemTitle class="text-sm font-medium">{{ cmd.command.name }}</ItemTitle>
                    <ItemDescription
                      class="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5"
                    >
                      <Clock class="w-3 h-3" />
                      {{ formatTime(cmd.timestamp) }}
                    </ItemDescription>
                  </ItemContent>
                  <ChevronRight class="w-4 h-4 text-muted-foreground/30 mr-3 shrink-0" />
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
                <Sun
                  class="w-5 h-5 text-muted-foreground rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
                />
                <Moon
                  class="absolute w-5 h-5 text-muted-foreground rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
                />
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


