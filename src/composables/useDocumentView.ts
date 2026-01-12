import { reactive, readonly } from 'vue'
import { useDocumentStore } from '@/stores/document'

/**
 * Read-only document view model for UI consumption.
 * Exposes document data without allowing direct mutation.
 */
export function useDocumentView() {
  const store = useDocumentStore()

  const document = reactive({
    get sources() {
      return store.sources
    },
    get sourceFileList() {
      return readonly(store.sourceFileList)
    },
    get pages() {
      return readonly(store.pages)
    },
    get contentPages() {
      return readonly(store.contentPages)
    },
    get contentPageCount() {
      return store.contentPageCount
    },
    get pageCount() {
      return store.pageCount
    },
    get selectedCount() {
      return store.selectedCount
    },
    get selectedPages() {
      return readonly(store.selectedPages)
    },
    get selectedIds() {
      return store.selection.selectedIds
    },
    get lastSelectedId() {
      return store.selection.lastSelectedId
    },
    get metadata() {
      return readonly(store.metadata)
    },
    get security() {
      return readonly(store.security)
    },
    get bookmarksTree() {
      return readonly(store.bookmarksTree)
    },
    get projectTitle() {
      return store.projectTitle
    },
    get isTitleLocked() {
      return store.isTitleLocked
    },
    getSourceColor(sourceId: string, fallback = 'gray') {
      return store.sources.get(sourceId)?.color ?? fallback
    },
  })

  return document
}

export type DocumentView = ReturnType<typeof useDocumentView>
