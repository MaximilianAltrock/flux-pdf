<script setup lang="ts">
import { shallowRef } from 'vue'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FileText, Tag, Lock } from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUiStore } from '@/stores/ui'

// Sub-components
import InspectorStructure from './inspector/InspectorStructure.vue'
import InspectorMetadata from './inspector/InspectorMetadata.vue'
import InspectorSecurity from './inspector/InspectorSecurity.vue'
import InspectorHistory from './inspector/InspectorHistory.vue'

const ui = useUiStore()

type InspectorTab = 'structure' | 'metadata' | 'security'
const inspectorTabs = new Set<InspectorTab>(['structure', 'metadata', 'security'])

const inspectorLabelMinSize = 15
const showTabLabels = shallowRef(true)

function handleInspectorResize(size: number) {
  showTabLabels.value = size >= inspectorLabelMinSize
}

function handleInspectorTabChange(value: string | number) {
  if (typeof value !== 'string') return
  if (inspectorTabs.has(value as InspectorTab)) {
    ui.setInspectorTab(value as InspectorTab)
  }
}
</script>

<template>
  <ResizablePanel
    as-child
    :default-size="15"
    :min-size="10"
    :max-size="20"
    @resize="handleInspectorResize"
  >
    <aside
      class="bg-sidebar border-l border-sidebar-border text-sidebar-foreground flex flex-col overflow-hidden h-full select-none"
    >
      <ResizablePanelGroup direction="vertical">
        <!-- Top Half: Document Controller -->
        <ResizablePanel :default-size="60" :min-size="30" class="flex flex-col">
          <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
            <!-- TAB BAR -->
            <Tabs
              :model-value="ui.inspectorTab"
              @update:model-value="handleInspectorTabChange"
              class="flex-1 min-h-0 gap-0"
            >
              <div
                class="h-9 px-2 border-b border-sidebar-border/40 bg-sidebar flex items-center"
              >
                <TabsList class="bg-transparent gap-1 w-full justify-start">
                  <Tooltip :disabled="showTabLabels">
                    <TooltipTrigger as-child>
                      <TabsTrigger value="structure">
                        <FileText />
                        <span :class="showTabLabels ? '' : 'sr-only'">Structure</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Structure</TooltipContent>
                  </Tooltip>
                  <Tooltip :disabled="showTabLabels">
                    <TooltipTrigger as-child>
                      <TabsTrigger value="metadata">
                        <Tag />
                        <span :class="showTabLabels ? '' : 'sr-only'">Metadata</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Metadata</TooltipContent>
                  </Tooltip>
                  <Tooltip :disabled="showTabLabels">
                    <TooltipTrigger as-child>
                      <TabsTrigger value="security">
                        <Lock />
                        <span :class="showTabLabels ? '' : 'sr-only'">Security</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Security</TooltipContent>
                  </Tooltip>
                </TabsList>
              </div>

              <!-- TAB CONTENT AREA -->
              <ScrollArea class="flex-1 min-h-0 bg-sidebar">
                <!-- A. STRUCTURE TAB -->
                <TabsContent value="structure">
                  <InspectorStructure />
                </TabsContent>

                <!-- B. METADATA TAB -->
                <TabsContent value="metadata" class="p-5">
                  <InspectorMetadata />
                </TabsContent>

                <!-- C. SECURITY TAB -->
                <TabsContent value="security" class="p-5">
                  <InspectorSecurity />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle with-handle />

        <!-- Bottom Half: History -->
        <ResizablePanel :default-size="40" :min-size="20" class="flex flex-col">
          <InspectorHistory />
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  </ResizablePanel>
</template>
