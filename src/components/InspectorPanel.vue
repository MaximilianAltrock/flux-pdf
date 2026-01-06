<script setup lang="ts">
import { ref } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { Tree, TreeItem } from '@/components/ui/tree'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperSeparator,
  StepperTitle,
  StepperDescription,
} from '@/components/ui/stepper'
import { FileText, Tag, Lock, Eye, EyeOff, ChevronRight, Crosshair, Check, Circle, Dot } from 'lucide-vue-next'
import type { UiBookmarkNode } from '@/types'

const store = useDocumentStore()
const { historyList, jumpTo } = useCommandManager()

function addCustomBookmark() {
  const pageId = store.selection.lastSelectedId
  if (!pageId) return
  store.addBookmarkForPage(pageId)
}

function scrollGridToPage(pageId: string) {
  const el = document.getElementById(`page-${pageId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    store.selectPage(pageId, false)
  }
}

// === METADATA TAB LOGIC ===
const keywordInput = ref('')
function addKeyword() {
  const val = keywordInput.value.trim()
  if (val && !store.metadata.keywords.includes(val)) {
    store.metadata.keywords.push(val)
  }
  keywordInput.value = ''
}
function removeKeyword(k: string) {
  store.metadata.keywords = store.metadata.keywords.filter((item) => item !== k)
}

// === SECURITY TAB LOGIC ===
const showUserPassword = ref(false)
const showOwnerPassword = ref(false)

// Format timestamp
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <aside class="w-[260px] bg-surface border-l border-border flex flex-col shrink-0 overflow-hidden">
    <!-- Top Half: Document Controller -->
    <div class="flex-1 flex flex-col min-h-0 bg-background">
      <!-- TAB BAR -->
      <Tabs default-value="structure" class="flex-1 flex flex-col min-h-0">
        <TabsList class="flex h-8 shrink-0 bg-background border-b border-border rounded-none p-0">
          <TabsTrigger
            value="structure"
            class="ui-tab flex-1 rounded-none data-[state=active]:ui-tab-active data-[state=inactive]:ui-tab-inactive"
          >
            <FileText class="w-3 h-3" />
            structure
          </TabsTrigger>
          <TabsTrigger
            value="metadata"
            class="ui-tab flex-1 rounded-none data-[state=active]:ui-tab-active data-[state=inactive]:ui-tab-inactive"
          >
            <Tag class="w-3 h-3" />
            metadata
          </TabsTrigger>
          <TabsTrigger
            value="security"
            class="ui-tab flex-1 rounded-none data-[state=active]:ui-tab-active data-[state=inactive]:ui-tab-inactive"
          >
            <Lock class="w-3 h-3" />
            security
          </TabsTrigger>
        </TabsList>

        <!-- TAB CONTENT AREA -->
        <div class="flex-1 overflow-y-auto custom-scrollbar relative">
          <!-- A. STRUCTURE TAB (Auto-Generated TOC) -->
          <TabsContent value="structure" class="flex flex-col h-full mt-0">
          <div v-if="store.pageCount === 0" class="p-8 text-center">
            <p class="text-xs text-text-muted italic">Import files to see structure</p>
          </div>

          <div v-else class="py-2 flex flex-col min-h-0">
            <div class="px-4 pb-2">
              <p class="ui-label">Table of Contents</p>
              <p class="text-[10px] text-text-muted opacity-60">
                Drag & drop to reorder; drop into the indented area to nest
              </p>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto">
              <Tree
                :items="store.bookmarksTree"
                :get-key="(item) => item.id"
                @update:items="(val) => store.setBookmarksTree(val as UiBookmarkNode[], true)"
                class="w-full bg-transparent rounded-md p-2"
                v-slot="{ flattenItems }"
              >
                <TreeItem
                  v-for="item in flattenItems"
                  :key="item._id"
                  :item="item"
                  v-slot="{ isExpanded }"
                  class="group flex items-center h-7 px-2 rounded outline-none hover:bg-surface-hover cursor-default transition-colors focus:ring-primary focus:ring-2 data-[selected]:bg-primary/10"
                  :style="{ paddingLeft: `${10 + item.level * 14}px` }"
                >
                  <!-- Expander -->
                  <button
                    class="mr-1 text-text-muted/70 hover:text-text transition-colors"
                    :style="{ opacity: item.hasChildren ? 1 : 0.25 }"
                    @click.stop
                  >
                    <ChevronRight
                      class="w-3.5 h-3.5 transition-transform"
                      :class="isExpanded ? 'rotate-90' : ''"
                    />
                  </button>

                  <!-- Title -->
                  <span class="text-xs text-text-primary truncate flex-1 font-medium">
                    {{ (item.value as UiBookmarkNode).title }}
                  </span>

                  <!-- Target Action -->
                  <button
                    @click.stop="scrollGridToPage((item.value as UiBookmarkNode).pageId)"
                    class="opacity-0 group-hover:opacity-100 p-1 hover:text-primary transition-opacity"
                    title="Jump to section"
                  >
                    <Crosshair class="w-3.5 h-3.5" />
                  </button>
                </TreeItem>
              </Tree>
            </div>

            <div class="mt-3 px-4 border-t border-border/50 pt-3">
              <Button
                variant="outline"
                class="w-full text-xs text-text-muted border-dashed border-border hover:bg-surface hover:text-text transition-colors flex items-center justify-center gap-2 h-auto py-1.5"
                @click="addCustomBookmark"
              >
                <span>+ Add Bookmark to Selected Page</span>
              </Button>
              <p class="text-[9px] text-text-muted mt-2 text-center opacity-50">
                Select a page, then add a bookmark.
              </p>
            </div>
          </div>
          </TabsContent>

          <!-- B. METADATA TAB -->
          <TabsContent value="metadata" class="p-4 space-y-5 mt-0">
          <!-- Title -->
          <div class="space-y-1">
            <Label>Document Title</Label>
            <Input
              v-model="store.projectTitle"
              type="text"
              placeholder="e.g. Final Contract 2024"
            />
          </div>

          <!-- Author -->
          <div class="space-y-1">
            <Label>Author</Label>
            <Input
              v-model="store.metadata.author"
              type="text"
              placeholder="e.g. John Doe"
            />
          </div>

          <!-- Subject -->
          <div class="space-y-1">
            <label class="ui-label">Subject</label>
            <textarea
              v-model="store.metadata.subject"
              rows="2"
              class="ui-input resize-none"
              placeholder="Brief description..."
            ></textarea>
          </div>

          <!-- Keywords (Token Input) -->
          <div class="space-y-1">
            <Label>Keywords</Label>

            <div class="flex flex-wrap gap-1.5 mb-2" v-if="store.metadata.keywords.length > 0">
              <span
                v-for="k in store.metadata.keywords"
                :key="k"
                class="ui-chip"
              >
                {{ k }}
                <Button
                  variant="ghost"
                  size="icon"
                  class="ml-1 h-4 w-4 hover:text-danger hover:bg-transparent text-lg leading-none"
                  @click="removeKeyword(k)"
                >
                  &times;
                </Button>
              </span>
            </div>

            <Input
              v-model="keywordInput"
              @keydown.enter.prevent="addKeyword"
              @keydown.tab.prevent="addKeyword"
              @blur="addKeyword"
              type="text"
              placeholder="Type and press Enter..."
            />
          </div>
          </TabsContent>

          <!-- C. SECURITY TAB -->
          <TabsContent value="security" class="p-4 space-y-6 mt-0">
          <!-- Encryption Toggle -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-text-primary">Encrypt Document</span>
            <Switch
              :checked="store.security.isEncrypted"
              @update:checked="(v: boolean) => store.security.isEncrypted = v"
            />
          </div>

          <!-- Password Fields (Animated) -->
          <div
            class="space-y-4 overflow-hidden transition-all duration-300"
            :class="
              store.security.isEncrypted
                ? 'opacity-100 max-h-[300px]'
                : 'opacity-30 max-h-0 pointer-events-none'
            "
          >
            <!-- User Pass -->
            <div class="space-y-1">
              <div class="flex justify-between items-center">
                <Label>Open Password</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click="showUserPassword = !showUserPassword"
                >
                  <Eye v-if="!showUserPassword" class="w-3 h-3" />
                  <EyeOff v-else class="w-3 h-3" />
                </Button>
              </div>
              <Input
                v-model="store.security.userPassword"
                :type="showUserPassword ? 'text' : 'password'"
                placeholder="Required to open"
              />
            </div>

            <!-- Owner Pass -->
            <div class="space-y-1">
              <div class="flex justify-between items-center">
                <Label>Edit Password</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click="showOwnerPassword = !showOwnerPassword"
                >
                  <Eye v-if="!showOwnerPassword" class="w-3 h-3" />
                  <EyeOff v-else class="w-3 h-3" />
                </Button>
              </div>
              <Input
                v-model="store.security.ownerPassword"
                :type="showOwnerPassword ? 'text' : 'password'"
                placeholder="Required to change permissions"
              />
            </div>

            <!-- Permissions Matrix -->
            <div class="pt-2">
              <Label class="block mb-2">Allowed Actions</Label>
              <div class="grid grid-cols-1 gap-3">
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="perm-print"
                    :checked="store.security.allowPrinting"
                    @update:checked="(v: boolean) => store.security.allowPrinting = v"
                  />
                  <label
                    for="perm-print"
                    class="text-xs text-text hover:text-white transition-colors cursor-pointer"
                  >
                    High Quality Printing
                  </label>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    id="perm-copy"
                    :checked="store.security.allowCopying"
                    @update:checked="(v: boolean) => store.security.allowCopying = v"
                  />
                  <label
                    for="perm-copy"
                    class="text-xs text-text hover:text-white transition-colors cursor-pointer"
                  >
                    Copy Text & Graphics
                  </label>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    id="perm-mod"
                    :checked="store.security.allowModifying"
                    @update:checked="(v: boolean) => store.security.allowModifying = v"
                  />
                  <label
                    for="perm-mod"
                    class="text-xs text-text hover:text-white transition-colors cursor-pointer"
                  >
                    Modify Pages
                  </label>
                </div>
              </div>
            </div>
          </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>

    <!-- Bottom Half: History -->
    <div class="h-2/5 min-h-[220px] flex flex-col bg-background border-t border-border">
      <div class="h-10 border-b border-border flex items-center px-4 bg-surface/50">
        <h2 class="text-xs font-bold text-text-muted uppercase tracking-wider">History</h2>
      </div>

      <div class="flex-1 overflow-y-auto p-4 pl-2">
        <Stepper
          v-if="historyList.length > 0"
          orientation="vertical"
          class="flex w-full flex-col gap-0"
          :model-value="historyList.findIndex(x => x.isCurrent) + 1"
        >
          <StepperItem
            v-for="(entry, index) in historyList"
            :key="index"
            :step="index + 1"
            v-slot="{ state }"
            class="relative flex w-full items-start gap-3 pb-6 last:pb-0"
            @click="jumpTo(entry.pointer)"
          >
            <!-- Connecting Line (Separator) -->
            <StepperSeparator
              v-if="index !== historyList.length - 1"
              class="absolute left-[11px] top-[24px] block h-full w-0.5 shrink-0 rounded-full bg-muted group-data-[state=completed]:bg-primary/50"
            />

            <!-- Step Indicator (Trigger) -->
            <StepperTrigger as-child>
              <Button
                :variant="state === 'completed' || state === 'active' ? 'default' : 'outline'"
                size="icon"
                class="z-10 h-6 w-6 rounded-full shrink-0 border transition-all"
                :class="[
                  state === 'active' && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                  state === 'completed' && 'bg-primary border-primary text-primary-foreground',
                  state === 'inactive' && 'bg-background border-border text-muted-foreground opacity-50'
                ]"
              >
                <Check v-if="state === 'completed'" class="w-3 h-3" />
                <Circle v-if="state === 'active'" class="w-2.5 h-2.5 fill-current" />
                <Dot v-if="state === 'inactive'" class="w-4 h-4" />
              </Button>
            </StepperTrigger>

            <!-- Content -->
            <div class="flex flex-col gap-0.5 pt-0.5 min-w-0">
              <StepperTitle
                class="text-xs font-medium truncate transition-colors"
                :class="[
                    state === 'active' ? 'text-text-primary' : '',
                    state === 'inactive' ? 'text-text-muted italic opacity-60' : 'text-text'
                ]"
              >
                {{ entry.command.name }}
              </StepperTitle>
              <StepperDescription class="text-[10px] text-text-muted opacity-50 font-mono">
                 {{ formatTime(entry.timestamp) }}
              </StepperDescription>
            </div>
          </StepperItem>
        </Stepper>

        <!-- Empty State -->
        <div v-else class="flex flex-col gap-2 pl-1">
            <div class="flex gap-3 relative pb-4 items-center">
                <!-- Fake marker -->
                <div class="relative z-10 w-6 h-6 rounded-full border border-border bg-background shrink-0 flex items-center justify-center text-muted-foreground" >
                    <Dot class="w-4 h-4" />
                </div>
                 <span class="text-xs text-text-muted italic opacity-50">
                  Start editing to see history
                </span>
            </div>
        </div>
      </div>
    </div>
  </aside>
</template>
