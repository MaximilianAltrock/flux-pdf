<script setup lang="ts">
import { computed } from 'vue'
import { Tree, TreeItem } from '@/components/ui/tree'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Crosshair, FileText, Tag } from 'lucide-vue-next'
import type { BookmarkNode } from '@/types'
import { scrollToPageId } from '@/utils/scroll-to-page'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const bookmarksTree = computed(() => props.state.document.bookmarksTree as BookmarkNode[])

function scrollGridToPage(pageId: string) {
  const didScroll = scrollToPageId(pageId, { behavior: 'smooth', block: 'center' })
  if (didScroll) {
    props.actions.selectPage(pageId, false)
  }
}

function addCustomBookmark() {
  const pageId = props.state.document.lastSelectedId
  if (!pageId) return
  props.actions.addBookmarkForPage(pageId)
}
</script>

<template>
  <div class="flex-1 min-h-0">
    <div v-if="props.state.document.pageCount === 0" class="p-12 text-center">
      <div
        class="bg-muted/30 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-border/40"
      >
        <FileText class="w-6 h-6 text-muted-foreground/40" />
      </div>
      <p class="text-xs text-muted-foreground font-medium">No pages imported</p>
      <p class="text-xxs text-muted-foreground/60 mt-1">Import files to see structure</p>
    </div>

    <div v-else class="flex flex-col min-h-0">
      <div class="px-4 py-3 border-b border-border/30 bg-muted/10">
        <p
          class="text-xxs font-bold text-muted-foreground/80 uppercase tracking-widest flex items-center gap-2"
        >
          Table of Contents
          <Badge variant="outline" class="text-xxs h-4 px-1 px-1.5 font-mono opacity-60"
            >AUTO</Badge
          >
        </p>
        <p class="text-xxs text-muted-foreground/60 mt-1 leading-relaxed">
          Drag & drop to reorder; nest by dropping into items.
        </p>
      </div>

      <div class="flex-1 min-h-0 py-2">
        <Tree
          :items="bookmarksTree"
          :get-key="(item) => item.id"
          @update:items="(val) => props.actions.setBookmarksTree(val as BookmarkNode[], true)"
          class="w-full px-2"
          v-slot="{ flattenItems }"
        >
          <TreeItem
            v-for="item in flattenItems"
            :key="item._id"
            :item="item"
            v-slot="{ isExpanded }"
            class="group h-9 px-2 rounded-md outline-none hover:bg-accent/60 cursor-default transition-all focus-visible:ring-1 focus-visible:ring-primary/40 data-[selected]:bg-primary/5 data-[selected]:text-primary overflow-hidden mb-0.5"
            :style="{ marginLeft: `${item.level * 12}px` }"
          >
            <div class="flex items-center w-full h-full gap-0">
              <!-- Expander -->
              <Button
                variant="ghost"
                size="icon-sm"
                class="mr-1 h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-transparent transition-colors p-0"
                :style="{ visibility: item.hasChildren ? 'visible' : 'hidden' }"
              >
                <ChevronRight
                  class="w-3.5 h-3.5 transition-transform duration-200"
                  :class="isExpanded ? 'rotate-90' : ''"
                />
              </Button>

              <!-- Title Container -->
              <div class="flex items-center min-w-0 max-w-full">
                <span
                  class="text-xs truncate font-medium text-foreground/80 group-hover:text-foreground transition-all leading-none py-1"
                >
                  {{ (item.value as BookmarkNode).title }}
                </span>

                <!-- Target Action - Attached to Title -->
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0 p-0 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200 ml-1"
                  title="Jump to section"
                  @click.stop="scrollGridToPage((item.value as BookmarkNode).pageId)"
                >
                  <Crosshair class="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </TreeItem>
        </Tree>
      </div>

      <div class="mx-3 my-4 p-4 rounded-lg bg-muted/20 border border-border/50 text-center">
        <Button
          variant="secondary"
          size="sm"
          class="w-full text-xs font-semibold h-8 bg-background/50 hover:bg-background border border-border/40 shadow-sm transition-all"
          @click="addCustomBookmark"
        >
          <Tag class="w-3 h-3 mr-2 text-primary/70" />
          Add Bookmark
        </Button>
        <p class="text-xxs text-muted-foreground/50 mt-2 font-medium uppercase tracking-tight">
          Sets anchor on selected page
        </p>
      </div>
    </div>
  </div>
</template>
