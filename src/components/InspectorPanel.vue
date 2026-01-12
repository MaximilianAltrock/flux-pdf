<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { Tree, TreeItem } from '@/components/ui/tree'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Timeline, TimelineItem, TimelineTime, TimelineTitle } from '@/components/ui/timeline'
import {
  FileText,
  Tag,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  Crosshair,
  X,
  Plus,
  History,
  FileDown,
} from 'lucide-vue-next'
import type { BookmarkNode, DocumentMetadata } from '@/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatTime } from '@/utils/format'
import { scrollToPageId } from '@/utils/scroll-to-page'
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

function addCustomBookmark() {
  const pageId = props.state.document.lastSelectedId
  if (!pageId) return
  props.actions.addBookmarkForPage(pageId)
}

function scrollGridToPage(pageId: string) {
  const didScroll = scrollToPageId(pageId, { behavior: 'smooth', block: 'center' })
  if (didScroll) {
    props.actions.selectPage(pageId, false)
  }
}

// === METADATA TAB LOGIC ===
const keywordInput = ref('')
const metadataTitle = computed({
  get: () => props.state.document.metadata.title,
  set: (value) => props.actions.setMetadata({ title: value }),
})
const metadataAuthor = computed({
  get: () => props.state.document.metadata.author,
  set: (value) => props.actions.setMetadata({ author: value }),
})
const metadataSubject = computed({
  get: () => props.state.document.metadata.subject,
  set: (value) => props.actions.setMetadata({ subject: value }),
})

function hasMeaningfulMetadata(metadata?: DocumentMetadata): metadata is DocumentMetadata {
  if (!metadata) return false
  return Boolean(
    metadata.title.trim() ||
      metadata.author.trim() ||
      metadata.subject.trim() ||
      metadata.keywords.length > 0,
  )
}

const metadataSources = computed(() =>
  props.state.document.sourceFileList.filter((source) => hasMeaningfulMetadata(source.metadata)),
)

function applyMetadataFromSource(sourceId: string) {
  props.actions.applyMetadataFromSource(sourceId)
}

function addKeyword() {
  const val = keywordInput.value.trim()
  if (val) props.actions.addKeyword(val)
  keywordInput.value = ''
}
function removeKeyword(k: string) {
  props.actions.removeKeyword(k)
}

// === SECURITY TAB LOGIC ===
const showUserPassword = ref(false)
const showOwnerPassword = ref(false)

const securityEncrypted = computed({
  get: () => props.state.document.security.isEncrypted,
  set: (value) => props.actions.setSecurity({ isEncrypted: value }),
})

const securityUserPassword = computed({
  get: () => props.state.document.security.userPassword ?? '',
  set: (value) => props.actions.setSecurity({ userPassword: value }),
})

const securityOwnerPassword = computed({
  get: () => props.state.document.security.ownerPassword ?? '',
  set: (value) => props.actions.setSecurity({ ownerPassword: value }),
})

const allowPrinting = computed({
  get: () => props.state.document.security.allowPrinting,
  set: (value) => props.actions.setSecurity({ allowPrinting: value }),
})

const allowCopying = computed({
  get: () => props.state.document.security.allowCopying,
  set: (value) => props.actions.setSecurity({ allowCopying: value }),
})

const allowModifying = computed({
  get: () => props.state.document.security.allowModifying,
  set: (value) => props.actions.setSecurity({ allowModifying: value }),
})

</script>

<template>
  <ResizablePanel as-child :default-size="20" :min-size="15" :max-size="30">
    <aside
      class="bg-sidebar border-l border-border flex flex-col overflow-hidden h-full select-none"
    >
      <ResizablePanelGroup direction="vertical">
        <!-- Top Half: Document Controller -->
        <ResizablePanel :default-size="60" :min-size="30" class="flex flex-col overflow-hidden">
          <div class="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
            <!-- TAB BAR -->
            <Tabs
              default-value="structure"
              class="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden"
            >
              <div
                class="h-9 px-1 border-b border-border/60 bg-sidebar/50 backdrop-blur-sm flex items-center"
              >
                <TabsList class="bg-transparent h-7 p-0 gap-1 w-full justify-start">
                  <TabsTrigger
                    value="structure"
                    class="h-7 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-sm transition-all flex items-center gap-1.5"
                  >
                    <FileText class="w-3 h-3" />
                    structure
                  </TabsTrigger>
                  <TabsTrigger
                    value="metadata"
                    class="h-7 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-sm transition-all flex items-center gap-1.5"
                  >
                    <Tag class="w-3 h-3" />
                    metadata
                  </TabsTrigger>
                  <TabsTrigger
                    value="security"
                    class="h-7 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-sm transition-all flex items-center gap-1.5"
                  >
                    <Lock class="w-3 h-3" />
                    security
                  </TabsTrigger>
                </TabsList>
              </div>

              <!-- TAB CONTENT AREA -->
              <ScrollArea class="flex-1 min-h-0">
                <!-- A. STRUCTURE TAB (Auto-Generated TOC) -->
                <TabsContent value="structure" class="m-0 focus-visible:outline-none">
                  <div v-if="props.state.document.pageCount === 0" class="p-12 text-center">
                    <div
                      class="bg-muted/30 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-border/40"
                    >
                      <FileText class="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p class="text-xs text-muted-foreground font-medium">No pages imported</p>
                    <p class="text-xxs text-muted-foreground/60 mt-1">
                      Import files to see structure
                    </p>
                  </div>

                  <div v-else class="flex flex-col min-h-0">
                    <div class="px-4 py-3 border-b border-border/30 bg-muted/10">
                      <p
                        class="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest flex items-center gap-2"
                      >
                        Table of Contents
                        <Badge
                          variant="outline"
                          class="text-[9px] h-4 px-1 px-1.5 font-mono opacity-60"
                          >AUTO</Badge
                        >
                      </p>
                      <p class="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">
                        Drag & drop to reorder; nest by dropping into items.
                      </p>
                    </div>

                    <div class="flex-1 min-h-0 py-2">
                      <Tree
                        :items="props.state.document.bookmarksTree"
                        :get-key="(item) => item.id"
                        @update:items="
                          (val) => props.actions.setBookmarksTree(val as BookmarkNode[], true)
                        "
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
                                @click.stop="
                                  scrollGridToPage((item.value as BookmarkNode).pageId)
                                "
                              >
                                <Crosshair class="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </TreeItem>
                      </Tree>
                    </div>

                    <div
                      class="mx-3 my-4 p-4 rounded-lg bg-muted/20 border border-border/50 text-center"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        class="w-full text-xs font-semibold h-8 bg-background/50 hover:bg-background border border-border/40 shadow-sm transition-all"
                        @click="addCustomBookmark"
                      >
                        <Tag class="w-3 h-3 mr-2 text-primary/70" />
                        Add Bookmark
                      </Button>
                      <p
                        class="text-[9px] text-muted-foreground/50 mt-2 font-medium uppercase tracking-tight"
                      >
                        Sets anchor on selected page
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <!-- B. METADATA TAB -->
                <TabsContent value="metadata" class="p-5 m-0 focus-visible:outline-none">
                  <div class="space-y-6">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold">
                          Import Metadata
                        </p>
                        <p class="text-[9px] text-muted-foreground/50">
                          Auto-fills once when empty, or apply manually from a source.
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button
                            variant="secondary"
                            size="sm"
                            class="h-7 px-2.5 text-[10px]"
                            :disabled="metadataSources.length === 0"
                          >
                            <FileDown class="w-3 h-3 mr-1.5" />
                            Apply
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="min-w-[220px]">
                          <DropdownMenuItem
                            v-for="source in metadataSources"
                            :key="source.id"
                            @select="applyMetadataFromSource(source.id)"
                          >
                            <span class="truncate">{{ source.filename }}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem v-if="metadataSources.length === 0" disabled>
                            No metadata found
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <FieldGroup class="gap-5">
                      <Field>
                        <FieldLabel
                          for="metadata-title"
                          class="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
                          >Document Title</FieldLabel
                        >
                        <FieldContent>
                          <Input
                            id="metadata-title"
                            v-model="metadataTitle"
                            type="text"
                            class="h-8 text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60"
                            placeholder="e.g. Project Specs 2026"
                          />
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel
                          for="metadata-author"
                          class="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
                          >Author</FieldLabel
                        >
                        <FieldContent>
                          <Input
                            id="metadata-author"
                            v-model="metadataAuthor"
                            type="text"
                            class="h-8 text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60"
                            placeholder="Full name or organization"
                          />
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel
                          for="metadata-subject"
                          class="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
                          >Subject</FieldLabel
                        >
                        <FieldContent>
                          <Textarea
                            id="metadata-subject"
                            v-model="metadataSubject"
                            rows="3"
                            class="resize-none text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60 min-h-0"
                            placeholder="Brief description of the document..."
                          />
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel
                          for="metadata-keywords"
                          class="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
                          >Keywords</FieldLabel
                        >
                        <FieldContent class="space-y-2.5">
                          <div
                            v-if="props.state.document.metadata.keywords.length > 0"
                            class="flex flex-wrap gap-1.5 items-center"
                          >
                            <Badge
                              v-for="k in props.state.document.metadata.keywords"
                              :key="k"
                              variant="secondary"
                              class="pl-2 pr-0.5 h-6 gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                            >
                              <span class="text-[10px] font-medium leading-none">{{ k }}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                class="h-5 w-5 rounded-full hover:bg-background/50 hover:text-destructive transition-colors"
                                @click="removeKeyword(k)"
                              >
                                <X class="w-3 h-3" />
                              </Button>
                            </Badge>
                          </div>

                          <div class="relative group">
                            <Input
                              id="metadata-keywords"
                              v-model="keywordInput"
                              @keydown.enter.prevent="addKeyword"
                              @keydown.tab.prevent="addKeyword"
                              @blur="addKeyword"
                              type="text"
                              class="h-8 text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60 pr-8"
                              placeholder="Add tag and press Enter..."
                            />
                            <div
                              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary/40 transition-colors pointer-events-none"
                            >
                              <Plus class="w-3 h-3" />
                            </div>
                          </div>
                        </FieldContent>
                      </Field>
                    </FieldGroup>
                  </div>
                </TabsContent>

                <!-- C. SECURITY TAB -->
                <TabsContent value="security" class="p-5 m-0 focus-visible:outline-none">
                  <div class="space-y-6">
                    <div
                      class="bg-muted/30 border border-border/50 rounded-lg p-4 transition-all"
                      :class="
                        props.state.document.security.isEncrypted
                          ? 'border-primary/20 ring-1 ring-primary/5 bg-primary/[0.02]'
                          : ''
                      "
                    >
                      <Field orientation="horizontal" class="items-center justify-between gap-4">
                        <div class="space-y-0.5">
                          <FieldLabel
                            for="security-encrypted"
                            class="text-xs font-bold text-foreground transition-colors"
                            :class="props.state.document.security.isEncrypted ? 'text-primary' : ''"
                          >
                            Document Encryption
                          </FieldLabel>
                          <p class="text-[10px] text-muted-foreground/60 leading-tight">
                            Apply password protection to this file
                          </p>
                        </div>
                        <Switch
                          id="security-encrypted"
                          :checked="securityEncrypted"
                          @update:checked="(v: boolean) => (securityEncrypted = v)"
                          class="data-[state=checked]:bg-primary"
                        />
                      </Field>
                    </div>

                    <!-- Password Fields (Animated) -->
                    <div
                      class="space-y-6 overflow-hidden transition-all duration-500 ease-out"
                      :class="
                        props.state.document.security.isEncrypted
                          ? 'opacity-100 max-h-[800px] blur-0'
                          : 'opacity-0 max-h-0 blur-sm pointer-events-none'
                      "
                    >
                      <FieldGroup class="gap-5 px-1">
                        <!-- User Pass -->
                        <Field>
                          <div class="flex justify-between items-center mb-1.5">
                            <FieldLabel
                              for="security-user-pass"
                              class="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold"
                              >Open Password</FieldLabel
                            >
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-5 w-5 opacity-50 hover:opacity-100 transition-opacity"
                              @click="showUserPassword = !showUserPassword"
                            >
                              <Eye v-if="!showUserPassword" class="w-3 h-3" />
                              <EyeOff v-else class="w-3 h-3" />
                            </Button>
                          </div>
                          <FieldContent>
                            <Input
                              id="security-user-pass"
                              v-model="securityUserPassword"
                              :type="showUserPassword ? 'text' : 'password'"
                              class="h-8 text-xs bg-background/50 border-border/60"
                              placeholder="Required to open document"
                            />
                          </FieldContent>
                        </Field>

                        <!-- Owner Pass -->
                        <Field>
                          <div class="flex justify-between items-center mb-1.5">
                            <FieldLabel
                              for="security-owner-pass"
                              class="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold"
                              >Permissions Password</FieldLabel
                            >
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-5 w-5 opacity-50 hover:opacity-100 transition-opacity"
                              @click="showOwnerPassword = !showOwnerPassword"
                            >
                              <Eye v-if="!showOwnerPassword" class="w-3 h-3" />
                              <EyeOff v-else class="w-3 h-3" />
                            </Button>
                          </div>
                          <FieldContent>
                            <Input
                              id="security-owner-pass"
                              v-model="securityOwnerPassword"
                              :type="showOwnerPassword ? 'text' : 'password'"
                              class="h-8 text-xs bg-background/50 border-border/60"
                              placeholder="Required to change settings"
                            />
                          </FieldContent>
                        </Field>
                      </FieldGroup>

                      <!-- Permissions Matrix -->
                      <div class="space-y-4 pt-2 border-t border-border/40">
                        <FieldLabel class="text-[11px] font-bold text-foreground px-1"
                          >Access Control</FieldLabel
                        >
                        <div class="grid gap-3 bg-muted/20 border border-border/30 rounded-md p-3">
                          <Field orientation="horizontal" class="items-center gap-3">
                            <Checkbox
                              id="perm-print"
                              :checked="allowPrinting"
                              @update:checked="(v: boolean) => (allowPrinting = v)"
                              class="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <div class="space-y-0.5">
                              <FieldLabel
                                for="perm-print"
                                class="text-xs font-medium text-foreground/80 cursor-pointer"
                              >
                                High Quality Printing
                              </FieldLabel>
                              <p class="text-[9px] text-muted-foreground/50 leading-none">
                                Allows high-res print output
                              </p>
                            </div>
                          </Field>

                          <Field orientation="horizontal" class="items-center gap-3">
                            <Checkbox
                              id="perm-copy"
                              :checked="allowCopying"
                              @update:checked="(v: boolean) => (allowCopying = v)"
                              class="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <div class="space-y-0.5">
                              <FieldLabel
                                for="perm-copy"
                                class="text-xs font-medium text-foreground/80 cursor-pointer"
                              >
                                content copying
                              </FieldLabel>
                              <p class="text-[9px] text-muted-foreground/50 leading-none">
                                Extract text and images
                              </p>
                            </div>
                          </Field>

                          <Field orientation="horizontal" class="items-center gap-3">
                            <Checkbox
                              id="perm-mod"
                              :checked="allowModifying"
                              @update:checked="(v: boolean) => (allowModifying = v)"
                              class="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <div class="space-y-0.5">
                              <FieldLabel
                                for="perm-mod"
                                class="text-xs font-medium text-foreground/80 cursor-pointer"
                              >
                                modification
                              </FieldLabel>
                              <p class="text-[9px] text-muted-foreground/50 leading-none">
                                Reorder, delete or insert pages
                              </p>
                            </div>
                          </Field>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle with-handle class="hover:bg-primary/20 transition-colors" />

        <!-- Bottom Half: History -->
        <ResizablePanel :default-size="40" :min-size="20" class="flex flex-col bg-sidebar/30">
          <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div
              class="h-9 px-4 border-b border-border/40 flex items-center justify-between bg-sidebar/50"
            >
              <h2
                class="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-2"
              >
                Session History
                <span class="w-1 h-1 rounded-full bg-primary/40"></span>
              </h2>
              <Badge
                variant="outline"
                class="text-[9px] h-4 font-mono opacity-50 p-0 px-1.5 border-none shadow-none text-muted-foreground/40"
                >{{ historyList.length }} steps</Badge
              >
            </div>

            <ScrollArea ref="historyScrollArea" class="flex-1 min-h-0">
              <div class="py-6 px-4">
                <Timeline v-if="historyList.length > 0" size="sm" variant="history" class="w-full">
                  <TimelineItem
                    v-for="(entry, index) in historyList"
                    :key="index"
                    :status="
                      entry.isCurrent ? 'in-progress' : entry.isUndone ? 'pending' : 'completed'
                    "
                    :show-connector="index !== historyList.length - 1"
                    icon-size="lg"
                    class="cursor-pointer group relative"
                    @click="jumpTo(entry.pointer)"
                  >
                    <template #title>
                      <TimelineTitle
                        class="text-xs font-semibold truncate transition-colors"
                        :class="[
                          entry.isCurrent
                            ? 'text-primary'
                            : 'text-foreground/70 group-hover:text-foreground',
                          entry.isUndone
                            ? 'text-muted-foreground/40 italic line-through decoration-muted-foreground/30'
                            : '',
                        ]"
                      >
                        {{ entry.command.name }}
                      </TimelineTitle>
                    </template>
                    <template #description>
                      <TimelineTime
                        class="mt-1 block text-[10px] text-muted-foreground/40 font-mono tracking-tighter"
                      >
                        {{ formatTime(entry.timestamp, true) }}
                      </TimelineTime>
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
                  <p class="text-[10px] font-bold uppercase tracking-widest">No Activity</p>
                </div>
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  </ResizablePanel>
</template>
