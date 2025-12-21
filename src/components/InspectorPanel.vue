<script setup lang="ts">
import { ref } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import BookmarkTree from './BookmarkTree.vue'
import { FileText, Tag, Lock, Eye, EyeOff, CheckSquare, Square } from 'lucide-vue-next'

const store = useDocumentStore()
const { historyList, jumpTo } = useCommandManager()

// === TABS LOGIC ===
type TabId = 'structure' | 'metadata' | 'security'
const activeTab = ref<TabId>('structure')

function addCustomBookmark() {
  const pageId = store.selection.lastSelectedId
  if (!pageId) return
  store.addBookmarkForPage(pageId)
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
      <div class="flex h-8 shrink-0 bg-background border-b border-border">
        <button
          v-for="tab in ['structure', 'metadata', 'security'] as const"
          :key="tab"
          @click="activeTab = tab"
          class="ui-tab"
          :class="
            activeTab === tab
              ? 'ui-tab-active'
              : 'ui-tab-inactive'
          "
        >
          <FileText v-if="tab === 'structure'" class="w-3 h-3" />
          <Tag v-if="tab === 'metadata'" class="w-3 h-3" />
          <Lock v-if="tab === 'security'" class="w-3 h-3" />
          {{ tab }}

          <!-- Active Indicator -->
          <div
            v-if="activeTab === tab"
            class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
          ></div>
        </button>
      </div>

      <!-- TAB CONTENT AREA -->
      <div class="flex-1 overflow-y-auto custom-scrollbar relative">
        <!-- A. STRUCTURE TAB (Auto-Generated TOC) -->
        <div v-if="activeTab === 'structure'" class="flex flex-col h-full">
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
              <BookmarkTree
                :nodes="store.bookmarksTree"
                @update:nodes="(val) => store.setBookmarksTree(val, true)"
              />
            </div>

            <div class="mt-3 px-4 border-t border-border/50 pt-3">
              <button
                class="w-full py-1.5 text-xs text-text-muted border border-dashed border-border rounded hover:bg-surface hover:text-text transition-colors flex items-center justify-center gap-2"
                @click="addCustomBookmark"
              >
                <span>+ Add Bookmark to Selected Page</span>
              </button>
              <p class="text-[9px] text-text-muted mt-2 text-center opacity-50">
                Select a page, then add a bookmark.
              </p>
            </div>
          </div>
        </div>

        <!-- B. METADATA TAB -->
        <div v-else-if="activeTab === 'metadata'" class="p-4 space-y-5">
          <!-- Title -->
          <div class="space-y-1">
            <label class="ui-label">Document Title</label>
            <input
              v-model="store.projectTitle"
              type="text"
              class="ui-input"
              placeholder="e.g. Final Contract 2024"
            />
          </div>

          <!-- Author -->
          <div class="space-y-1">
            <label class="ui-label">Author</label>
            <input
              v-model="store.metadata.author"
              type="text"
              class="ui-input"
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
            <label class="ui-label">Keywords</label>

            <div class="flex flex-wrap gap-1.5 mb-2" v-if="store.metadata.keywords.length > 0">
              <span
                v-for="k in store.metadata.keywords"
                :key="k"
                class="ui-chip"
              >
                {{ k }}
                <button @click="removeKeyword(k)" class="ml-1 hover:text-danger">&times;</button>
              </span>
            </div>

            <input
              v-model="keywordInput"
              @keydown.enter.prevent="addKeyword"
              @keydown.tab.prevent="addKeyword"
              @blur="addKeyword"
              type="text"
              class="ui-input"
              placeholder="Type and press Enter..."
            />
          </div>
        </div>

        <!-- C. SECURITY TAB -->
        <div v-else-if="activeTab === 'security'" class="p-4 space-y-6">
          <!-- Encryption Toggle -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-text-primary">Encrypt Document</span>
            <button
              @click="store.security.isEncrypted = !store.security.isEncrypted"
              class="w-9 h-5 rounded-full relative transition-colors duration-200 ease-in-out"
              :class="store.security.isEncrypted ? 'bg-primary' : 'bg-border'"
            >
              <div
                class="absolute top-1 left-1 bg-white w-3 h-3 rounded-full shadow-sm transition-transform duration-200"
                :class="store.security.isEncrypted ? 'translate-x-4' : 'translate-x-0'"
              ></div>
            </button>
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
                <label class="ui-label">Open Password</label>
                <button
                  @click="showUserPassword = !showUserPassword"
                  class="text-text-muted hover:text-white"
                >
                  <Eye v-if="!showUserPassword" class="w-3 h-3" />
                  <EyeOff v-else class="w-3 h-3" />
                </button>
              </div>
              <input
                v-model="store.security.userPassword"
                :type="showUserPassword ? 'text' : 'password'"
                class="ui-input"
                placeholder="Required to open"
              />
            </div>

            <!-- Owner Pass -->
            <div class="space-y-1">
              <div class="flex justify-between items-center">
                <label class="ui-label">Edit Password</label>
                <button
                  @click="showOwnerPassword = !showOwnerPassword"
                  class="text-text-muted hover:text-white"
                >
                  <Eye v-if="!showOwnerPassword" class="w-3 h-3" />
                  <EyeOff v-else class="w-3 h-3" />
                </button>
              </div>
              <input
                v-model="store.security.ownerPassword"
                :type="showOwnerPassword ? 'text' : 'password'"
                class="ui-input"
                placeholder="Required to change permissions"
              />
            </div>

            <!-- Permissions Matrix -->
            <div class="pt-2">
              <label
                class="ui-label block mb-2"
                >Allowed Actions</label
              >
              <div class="grid grid-cols-1 gap-2">
                <button
                  @click="store.security.allowPrinting = !store.security.allowPrinting"
                  class="flex items-center gap-2 text-xs text-text hover:text-white transition-colors text-left"
                >
                  <CheckSquare
                    v-if="store.security.allowPrinting"
                    class="w-3.5 h-3.5 text-primary"
                  />
                  <Square v-else class="w-3.5 h-3.5 text-text-muted" />
                  High Quality Printing
                </button>
                <button
                  @click="store.security.allowCopying = !store.security.allowCopying"
                  class="flex items-center gap-2 text-xs text-text hover:text-white transition-colors text-left"
                >
                  <CheckSquare
                    v-if="store.security.allowCopying"
                    class="w-3.5 h-3.5 text-primary"
                  />
                  <Square v-else class="w-3.5 h-3.5 text-text-muted" />
                  Copy Text & Graphics
                </button>
                <button
                  @click="store.security.allowModify = !store.security.allowModify"
                  class="flex items-center gap-2 text-xs text-text hover:text-white transition-colors text-left"
                >
                  <CheckSquare v-if="store.security.allowModify" class="w-3.5 h-3.5 text-primary" />
                  <Square v-else class="w-3.5 h-3.5 text-text-muted" />
                  Modify Pages
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Half: History -->
    <div class="h-2/5 min-h-[220px] flex flex-col bg-background border-t border-border">
      <div class="h-10 border-b border-border flex items-center px-4 bg-surface/50">
        <h2 class="text-xs font-bold text-text-muted uppercase tracking-wider">History</h2>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <ul
          class="relative space-y-0 before:absolute before:inset-y-0 before:left-[19px] before:w-px before:bg-border before:z-0"
        >
          <li
            v-for="(entry, index) in historyList"
            :key="index"
            @click="jumpTo(entry.pointer)"
            class="relative z-10 pl-8 py-2 cursor-pointer group"
          >
            <!-- Timeline Dot -->
            <div
              class="absolute left-[15px] top-3.5 w-[9px] h-[9px] rounded-full border-2 transition-colors z-20 bg-background"
              :class="
                entry.isCurrent
                  ? 'border-selection bg-selection'
                  : entry.isUndone
                    ? 'border-text-muted opacity-50'
                    : 'border-selection bg-background'
              "
            ></div>

            <div
              class="text-xs font-medium transition-colors"
              :class="{
                'text-text-primary': entry.isCurrent,
                'text-text-muted italic opacity-60': entry.isUndone,
                'text-text': !entry.isCurrent && !entry.isUndone,
              }"
            >
              {{ entry.command.name }}
            </div>
            <div class="text-[10px] text-text-muted opacity-50 font-mono mt-0.5">
              {{ formatTime(entry.timestamp) }}
            </div>
          </li>

          <li
            v-if="historyList.length === 0"
            class="pl-8 py-2 text-xs text-text-muted italic opacity-50 relative z-10"
          >
            <div
              class="absolute left-[15px] top-3.5 w-[9px] h-[9px] rounded-full border-2 border-border bg-background z-20"
            ></div>
            Start editing to see history
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>
