<script setup lang="ts">
import { FilePlus, FileText, Info, Trash2 } from 'lucide-vue-next'
import { formatFileSize } from '@/shared/utils/format'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/shared/components/ui/item'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/components/ui/empty'
import type { SourceFile } from '@/shared/types'

const props = defineProps<{
  pageCount: number
  sources: ReadonlyArray<SourceFile>
  totalSize: number
}>()

const emit = defineEmits<{
  removeSource: [sourceId: string]
}>()
</script>

<template>
  <div class="px-4 py-4">
    <div class="flex items-center gap-2 ui-kicker mb-3">
      <Info class="w-3.5 h-3.5" />
      <span>Document Info</span>
    </div>
    <div class="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
      <Card class="rounded-lg shadow-none ui-panel-muted py-0">
        <CardContent class="p-3">
          <div class="text-2xl font-bold text-foreground">
            {{ props.pageCount }}
          </div>
          <div class="ui-kicker">Pages</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg shadow-none ui-panel-muted py-0">
        <CardContent class="p-3">
          <div class="text-2xl font-bold text-foreground">{{ props.sources.length }}</div>
          <div class="ui-kicker">Files</div>
        </CardContent>
      </Card>
    </div>
    <div class="mt-3 ui-caption">
      Est. size: {{ formatFileSize(props.totalSize) }}
    </div>
  </div>

  <div class="p-4 space-y-3">
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2 ui-kicker">
        <FileText class="w-3.5 h-3.5" />
        <span>Source Files</span>
      </div>
      <Badge variant="secondary" class="h-5">{{ props.sources.length }}</Badge>
    </div>

    <Empty
      v-if="props.sources.length === 0"
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
        v-for="source in props.sources"
        :key="source.id"
        variant="outline"
        size="sm"
        class="group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-border/60 bg-card/60 px-3 py-2.5 hover:bg-muted/30"
      >
        <ItemMedia variant="icon" class="rounded-md bg-muted/30 border-border/60">
          <FileText class="w-4 h-4 text-primary" />
        </ItemMedia>
        <ItemContent class="flex-1 min-w-0 py-0 px-0 overflow-hidden">
          <ItemTitle class="text-sm font-semibold truncate">
            {{ source.filename }}
          </ItemTitle>
          <ItemDescription class="text-xs text-muted-foreground mt-0.5">
            {{ formatFileSize(source.fileSize) }}
          </ItemDescription>
        </ItemContent>
        <Button
          variant="ghost"
          size="icon"
          class="h-10 w-10 justify-self-end text-muted-foreground active:text-destructive active:bg-destructive/10"
          @click="emit('removeSource', source.id)"
          aria-label="Remove source file"
        >
          <Trash2 class="w-4 h-4" />
        </Button>
      </Item>
    </ItemGroup>
  </div>
</template>
