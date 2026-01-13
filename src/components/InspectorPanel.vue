<script setup lang="ts">
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FileText, Tag, Lock } from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

// Sub-components
import InspectorStructure from './inspector/InspectorStructure.vue'
import InspectorMetadata from './inspector/InspectorMetadata.vue'
import InspectorSecurity from './inspector/InspectorSecurity.vue'
import InspectorHistory from './inspector/InspectorHistory.vue'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()
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
                class="h-9 px-2 border-b border-border/40 bg-muted/10 backdrop-blur-sm flex items-center"
              >
                <TabsList class="bg-transparent h-7 p-0 gap-2 w-full justify-start">
                  <TabsTrigger
                    value="structure"
                    class="h-7 px-2 text-xxs font-bold uppercase tracking-tight text-muted-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-primary/10 rounded-[3px] transition-all flex items-center gap-1.5 relative group"
                  >
                    <FileText
                      class="w-3 h-3 group-data-[state=active]:scale-110 transition-transform"
                    />
                    structure
                    <div
                      class="absolute -bottom-[5px] inset-x-1 h-[1.5px] bg-primary rounded-t-full scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-center"
                    ></div>
                  </TabsTrigger>
                  <TabsTrigger
                    value="metadata"
                    class="h-7 px-2 text-xxs font-bold uppercase tracking-tight text-muted-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-primary/10 rounded-[3px] transition-all flex items-center gap-1.5 relative group"
                  >
                    <Tag class="w-3 h-3 group-data-[state=active]:scale-110 transition-transform" />
                    metadata
                    <div
                      class="absolute -bottom-[5px] inset-x-1 h-[1.5px] bg-primary rounded-t-full scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-center"
                    ></div>
                  </TabsTrigger>
                  <TabsTrigger
                    value="security"
                    class="h-7 px-2 text-xxs font-bold uppercase tracking-tight text-muted-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-primary/10 rounded-[3px] transition-all flex items-center gap-1.5 relative group"
                  >
                    <Lock
                      class="w-3 h-3 group-data-[state=active]:scale-110 transition-transform"
                    />
                    security
                    <div
                      class="absolute -bottom-[5px] inset-x-1 h-[1.5px] bg-primary rounded-t-full scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-center"
                    ></div>
                  </TabsTrigger>
                </TabsList>
              </div>

              <!-- TAB CONTENT AREA -->
              <ScrollArea class="flex-1 min-h-0">
                <!-- A. STRUCTURE TAB -->
                <TabsContent
                  value="structure"
                  class="m-0 focus-visible:outline-none h-full flex flex-col"
                >
                  <InspectorStructure :state="props.state" :actions="props.actions" />
                </TabsContent>

                <!-- B. METADATA TAB -->
                <TabsContent value="metadata" class="p-5 m-0 focus-visible:outline-none">
                  <InspectorMetadata :state="props.state" :actions="props.actions" />
                </TabsContent>

                <!-- C. SECURITY TAB -->
                <TabsContent value="security" class="p-5 m-0 focus-visible:outline-none">
                  <InspectorSecurity :state="props.state" :actions="props.actions" />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle with-handle class="hover:bg-primary/20 transition-colors" />

        <!-- Bottom Half: History -->
        <ResizablePanel :default-size="40" :min-size="20" class="flex flex-col bg-sidebar/30">
          <InspectorHistory :state="props.state" :actions="props.actions" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  </ResizablePanel>
</template>
