<script setup lang="ts">
import { computed } from 'vue'
import { Tree, TreeItem } from '@/components/ui/tree'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Crosshair, FileText, Plus } from 'lucide-vue-next'
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
          class="text-xxs font-bold text-muted-foreground/60 uppercase tracking-[0.1em] flex items-center gap-2"
        >
          Document Structure
          <Badge
            variant="outline"
            class="text-tiny h-3.5 px-1.5 font-mono opacity-40 border-muted-foreground/30 shadow-none uppercase"
            >Auto</Badge
          >
        </p>
        <p class="text-xxs text-muted-foreground/40 mt-1.5 leading-relaxed font-medium">
          Drag & drop to reorder entries. Nest items to create hierarchies.
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
            class="group h-9 px-2 rounded-[4px] outline-none hover:bg-muted/50 cursor-default transition-all focus-visible:ring-1 focus-visible:ring-primary/40 data-[selected]:bg-primary/10 data-[selected]:text-primary overflow-hidden mb-0.5"
            :style="{ marginLeft: `${item.level * 12}px` }"
          >
            <div class="flex items-center w-full h-full gap-0">
              <!-- Expander -->
              <Button
                variant="ghost"
                size="icon"
                class="mr-1 h-5 w-5 shrink-0 flex items-center justify-center text-muted-foreground/30 hover:text-foreground hover:bg-background/50 transition-all p-0 rounded-[3px]"
                :style="{ visibility: item.hasChildren ? 'visible' : 'hidden' }"
              >
                <ChevronRight
                  class="w-3 h-3 transition-transform duration-200"
                  :class="isExpanded ? 'rotate-90' : ''"
                />
              </Button>

              <!-- Title Container -->
              <div class="flex items-center min-w-0 max-w-full">
                <span
                  class="text-xs truncate font-semibold text-foreground/70 group-hover:text-foreground transition-colors leading-none py-1 pr-2"
                >
                  {{ (item.value as BookmarkNode).title }}
                </span>

                <!-- Target Action - Attached to Title -->
                <Button
                  variant="ghost"
                  size="icon"
                  class="opacity-0 group-hover:opacity-100 h-5 w-5 shrink-0 p-0 flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all duration-200 ml-auto rounded-[3px]"
                  title="Jump to section"
                  @click.stop="scrollGridToPage((item.value as BookmarkNode).pageId)"
                >
                  <Crosshair class="w-3 h-3" />
                </Button>
              </div>
            </div>
          </TreeItem>
        </Tree>
      </div>

      <div class="mx-4 mb-4 mt-2 p-3 rounded-lg bg-muted/10 border border-border/30 text-center">
        <Button
          variant="secondary"
          size="sm"
          class="w-full text-xxs font-bold h-7 bg-background shadow-xs hover:bg-muted border border-border/40 transition-all rounded-[4px] uppercase tracking-wider"
          @click="addCustomBookmark"
        >
          <Plus class="w-3 h-3 mr-1.5 text-primary" />
          New Bookmark
        </Button>
      </div>
    </div>
  </div>
</template>
