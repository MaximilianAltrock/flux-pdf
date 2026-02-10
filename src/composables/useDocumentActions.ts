import { storeToRefs } from 'pinia'
import { computed, inject, provide, type InjectionKey } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useHistoryStore } from '@/stores/history'
import { useUiStore } from '@/stores/ui'
import { useProjectsStore } from '@/stores/projects'
import { useSettingsStore } from '@/stores/settings'
import { useRouter } from 'vue-router'
import {
  DEFAULT_PROJECT_TITLE,
  DIFF_REQUIRED_SELECTION,
  ROTATION_DEFAULT_DEGREES,
  ROTATION_DELTA_DEGREES,
  TIMEOUTS_MS,
  type RotationDelta,
} from '@/constants'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useMobile } from '@/composables/useMobile'
import { useActiveElementBlur } from '@/composables/useActiveElementBlur'
import { usePdfRepository } from '@/services/pdfRepository'
import { createDocumentService, type ExportOptions } from '@/services/documentService'
import { useFileInput } from '@/composables/useFileInput'
import { getImportErrorMessage } from '@/domain/document/errors'
import { autoGenOutlineFromPages } from '@/utils/auto-gen-tree'
import {
  removeOutlineNode,
  removeBrokenOutlineTargets,
  setOutlineNodeDest,
  setOutlineNodeExpanded,
  setOutlineNodeStyle,
  setOutlineNodeTitle,
} from '@/utils/outline-tree'
import {
  RotatePagesCommand,
  DuplicatePagesCommand,
  DeletePagesCommand,
  AddPagesCommand,
  RemoveSourceCommand,
  ReorderPagesCommand,
  SplitGroupCommand,
  ResizePagesCommand,
  AddRedactionCommand,
  UpdateRedactionCommand,
  DeleteRedactionCommand,
  UpdateOutlineCommand,
  BatchCommand,
} from '@/commands'
import { UserAction } from '@/types/actions'
import type {
  OutlineNode,
  DocumentMetadata,
  PageEntry,
  PageReference,
  SecurityMetadata,
  RedactionMark,
} from '@/types'
import type { PreflightFix } from '@/types/linter'
import type { DocumentUiState } from '@/types/ui'

/**
 * Centralized action handlers for the application
 * All business logic lives here, keeping components thin
 */
export function useDocumentActions() {
  const store = useDocumentStore()
  const history = useHistoryStore()
  const ui = useUiStore()
  const projects = useProjectsStore()
  const settings = useSettingsStore()
  const {
    zoom,
    importJob: uiImportJob,
    exportJob: uiExportJob,
    ignoredPreflightRuleIds,
  } = storeToRefs(ui)
  const { preferences } = storeToRefs(settings)
  const autoGenerateOutlineSinglePage = computed(
    () => preferences.value.autoGenerateOutlineSinglePage,
  )
  const filenamePattern = computed(() => preferences.value.filenamePattern)
  const { activeProjectId, activeProjectMeta } = storeToRefs(projects)
  const { openFileDialog, clearFileInput } = useFileInput()
  const { execute, undo, redo, jumpTo, clearHistory } = history
  const { canUndo, canRedo, undoName, redoName, historyList } = storeToRefs(history)
  const toast = useToast()
  const { confirmDelete, confirm } = useConfirm()
  const { isMobile, haptic, shareFile, canShareFiles } = useMobile()
  const { blurActiveElement } = useActiveElementBlur()
  const router = useRouter()
  const pdfRepository = usePdfRepository()
  const uiState: DocumentUiState = {
    zoom,
    setZoom: ui.setZoom,
    setLoading: ui.setLoading,
    ignoredPreflightRuleIds,
    setIgnoredPreflightRuleIds: ui.setIgnoredPreflightRuleIds,
  }
  projects.bindUiState(uiState)
  const {
    importFiles,
    generateRawPdf,
    exportDocument: exportDocumentService,
    getSuggestedFilename,
    getEstimatedSize,
    clearExportError,
    parsePageRange,
    validatePageRange,
  } = createDocumentService({
    documentStore: store,
    historyStore: history,
    pdfRepository,
    ui: {
      setLoading: ui.setLoading,
      importJob: uiImportJob,
      exportJob: uiExportJob,
    },
    settings: { autoGenerateOutlineSinglePage, filenamePattern },
  })
  const exportJob = uiExportJob

  function normalizeProjectTitle(value: string) {
    let next = value.trim()
    if (!next) next = DEFAULT_PROJECT_TITLE
    return next.replace(/[/\\:]/g, '-')
  }

  // ============================================
  // File Handling
  // ============================================

  /**
   * Handle file input change event
   */
  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      handleImport(input.files, { addPages: true })
      clearFileInput()
    }
  }

  /**
   * Handle files dropped or selected
   */
  async function handleFilesSelected(files: FileList) {
    await handleImport(files, { addPages: true })
  }

  /**
   * Handle files added to the source registry (without inserting pages)
   */
  async function handleSourcesSelected(files: FileList) {
    await handleImport(files, { addPages: false })
  }

  async function handleImport(files: FileList | File[], options: { addPages: boolean }) {
    const result = await importFiles(files, { addPages: options.addPages })
    if (!result.ok) {
      toast.error('Failed to load files', result.error.message)
      return
    }

    const { successes, errors, totalPages } = result.value

    if (successes.length > 0) {
      if (options.addPages) {
        toast.success(
          `Added ${successes.length} file${successes.length > 1 ? 's' : ''}`,
          `${totalPages} page${totalPages > 1 ? 's' : ''} added`,
        )
      } else {
        toast.success(
          `Registered ${successes.length} source file${successes.length > 1 ? 's' : ''}`,
          `${totalPages} page${totalPages > 1 ? 's' : ''} ready to add`,
        )
      }
    }

    if (errors.length > 0) {
      const detail = errors
        .map((e) => {
          if (e.errorCode) {
            return getImportErrorMessage(e.errorCode, e.error)
          }
          return e.error
        })
        .filter((e): e is string => typeof e === 'string' && e.length > 0)
        .join(', ')

      toast.error(
        `Failed to load ${errors.length} file${errors.length > 1 ? 's' : ''}`,
        detail || 'Unknown error',
      )
    }
  }

  /**
   * Handle source file dropped from SourceRail onto grid
   */
  function handleSourceDropped(sourceId: string) {
    const sourceFile = store.sources.get(sourceId)
    if (!sourceFile) return

    const groupId = crypto.randomUUID()
    const newPages: PageReference[] = []

    for (let i = 0; i < sourceFile.pageCount; i++) {
      const metrics = sourceFile.pageMetaData?.[i]
      newPages.push({
        id: crypto.randomUUID(),
        sourceFileId: sourceFile.id,
        sourcePageIndex: i,
        rotation: ROTATION_DEFAULT_DEGREES,
        width: metrics?.width,
        height: metrics?.height,
        groupId,
      })
    }

    execute(new AddPagesCommand(sourceFile, newPages, false))
  }

  /**
   * Handle single source page dropped from SourceRail onto grid
   */
  function handleSourcePageDropped(sourceId: string, pageIndex: number) {
    const sourceFile = store.sources.get(sourceId)
    if (!sourceFile) return
    if (pageIndex < 0 || pageIndex >= sourceFile.pageCount) return

    const pageRef: PageReference = {
      id: crypto.randomUUID(),
      sourceFileId: sourceFile.id,
      sourcePageIndex: pageIndex,
      rotation: ROTATION_DEFAULT_DEGREES,
      width: sourceFile.pageMetaData?.[pageIndex]?.width,
      height: sourceFile.pageMetaData?.[pageIndex]?.height,
      groupId: crypto.randomUUID(),
    }

    execute(new AddPagesCommand(sourceFile, [pageRef], false))
  }

  /**
   * Handle multiple source pages dropped from SourceRail onto grid
   */
  function handleSourcePagesDropped(pages: { sourceId: string; pageIndex: number }[]) {
    if (!pages || pages.length === 0) return

    const grouped = new Map<string, Set<number>>()
    for (const page of pages) {
      if (!page || !page.sourceId || !Number.isInteger(page.pageIndex)) continue
      const sourceFile = store.sources.get(page.sourceId)
      if (!sourceFile) continue
      if (page.pageIndex < 0 || page.pageIndex >= sourceFile.pageCount) continue

      if (!grouped.has(page.sourceId)) grouped.set(page.sourceId, new Set())
      grouped.get(page.sourceId)!.add(page.pageIndex)
    }

    for (const [sourceId, pageSet] of grouped) {
      const sourceFile = store.sources.get(sourceId)
      if (!sourceFile) continue

      const sorted = Array.from(pageSet).sort((a, b) => a - b)
      if (sorted.length === 0) continue

      const groupId = crypto.randomUUID()
      const newPages: PageReference[] = sorted.map((pageIndex) => ({
        id: crypto.randomUUID(),
        sourceFileId: sourceFile.id,
        sourcePageIndex: pageIndex,
        rotation: ROTATION_DEFAULT_DEGREES,
        width: sourceFile.pageMetaData?.[pageIndex]?.width,
        height: sourceFile.pageMetaData?.[pageIndex]?.height,
        groupId,
      }))

      execute(new AddPagesCommand(sourceFile, newPages, false))
    }
  }

  function downloadFile(data: Uint8Array, filename: string, mimeType: string): void {
    const arrayBuffer =
      data.buffer instanceof ArrayBuffer
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data.slice().buffer

    const blob = new Blob([arrayBuffer], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => URL.revokeObjectURL(url), TIMEOUTS_MS.OBJECT_URL_REVOKE)
  }

  function getExportPagesForWarning(options: ExportOptions): PageReference[] {
    if (options.pageRange) {
      const indices = parsePageRange(options.pageRange, store.contentPageCount)
      return indices.map((i) => store.contentPages[i]).filter((p): p is PageReference => !!p)
    }
    return store.contentPages
  }

  function warnIfRedactions(pages: PageReference[]) {
    const count = pages.reduce((sum, page) => sum + (page.redactions?.length ?? 0), 0)
    if (count <= 0) return
    const label = count === 1 ? '1 Redaction' : `${count} Redactions`
    toast.warning(
      `${label} applied. This data will be permanently removed.`,
      undefined,
      TIMEOUTS_MS.TOAST_WARNING,
    )
  }

  async function exportDocument(options: ExportOptions) {
    warnIfRedactions(getExportPagesForWarning(options))
    const result = await exportDocumentService(options)
    if (!result.ok) return result

    downloadFile(result.value.bytes, result.value.filename, result.value.mimeType)
    return result
  }

  /**
   * Handle reorder after drag-drop (undoable).
   */
  function handleReorderPages(previousOrder: PageEntry[], nextOrder: PageEntry[]) {
    execute(new ReorderPagesCommand(previousOrder, nextOrder))
  }

  /**
   * Handle section split (undoable).
   */
  function handleSplitGroup(index: number) {
    if (isMobile.value) {
      haptic('medium')
    }
    execute(new SplitGroupCommand(index))
  }

  // ============================================
  // Export Handling
  // ============================================

  /**
   * Handle export action (detects mobile vs desktop flow)
   */
  async function handleExport() {
    if (isMobile.value && canShareFiles.value) {
      await handleMobileExport()
    } else {
      openExportOptions(false)
    }
  }

  /**
   * Mobile-specific export with native share sheet
   */
  async function handleMobileExport() {
    try {
      ui.setLoading(true, 'Generating PDF...')

      const pagesToExport = store.contentPages
      if (pagesToExport.length === 0) {
        throw new Error('No pages to export')
      }
      warnIfRedactions(pagesToExport)

      const filename = store.projectTitle || 'document'
      const pdfResult = await generateRawPdf(pagesToExport, { compress: false })
      if (!pdfResult.ok) {
        throw new Error(pdfResult.error.message)
      }
      const pdfBytes = pdfResult.value
      const file = new File([pdfBytes as BlobPart], `${filename}.pdf`, {
        type: 'application/pdf',
      })

      ui.setLoading(false)

      const result = await shareFile(file, filename)
      if (result.shared) {
        toast.success('Shared successfully')
      } else if (result.downloaded) {
        toast.success('PDF downloaded')
      }
    } catch (error) {
      ui.setLoading(false)
      toast.error('Export failed', error instanceof Error ? error.message : 'Export failed')
    }
  }

  /**
   * Handle export selected pages action
   */
  function handleExportSelected() {
    if (isMobile.value) {
      haptic('light')
    }
    openExportOptions(true)
  }

  /**
   * Handle export success callback
   */
  function handleExportSuccess() {
    toast.success('PDF Exported')
  }

  function openExportOptions(selectedOnly = false) {
    blurActiveElement()
    ui.openExportModal(selectedOnly)
  }

  // ============================================
  // Page Actions
  // ============================================

  /**
   * Handle page preview action
   */
  function handlePagePreview(pageRef: PageReference) {
    store.selectPage(pageRef.id, false)
    ui.openPreviewModal(pageRef)
  }

  function handleClosePreview() {
    const pageRef = ui.previewPageRef
    if (pageRef) {
      store.selectPage(pageRef.id, false)
    }
    ui.closePreviewModal()
  }

  /**
   * Handle delete selected pages action
   */
  async function handleDeleteSelected() {
    if (store.selectedCount === 0) return

    // Desktop requires confirmation
    if (!isMobile.value) {
      const confirmed = await confirmDelete(store.selectedCount, 'page')
      if (!confirmed) return
    }

    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new DeletePagesCommand(selectedIds))
    store.clearSelection()

    if (isMobile.value) {
      haptic('medium')
      ui.exitMobileSelectionMode()
    }

    toast.success(
      'Pages deleted',
      `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} removed`,
      { label: 'UNDO', onClick: () => undo() },
    )
  }

  /**
   * Handle duplicate selected pages action
   */
  function handleDuplicateSelected() {
    if (store.selectedCount === 0) return

    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new DuplicatePagesCommand(selectedIds))

    if (isMobile.value) {
      haptic('light')
    }

    toast.success('Pages duplicated')
  }

  /**
   * Handle rotate selected pages action
   */
  function handleRotateSelected(degrees: RotationDelta) {
    if (store.selectedCount === 0) return

    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new RotatePagesCommand(selectedIds, degrees))

    if (isMobile.value) {
      haptic('light')
    }
  }

  /**
   * Handle Diff (Ghost Overlay) Action
   */
  function handleDiffSelected() {
    // 1. Validate
    if (store.selectedCount !== DIFF_REQUIRED_SELECTION) {
      // 2. Feedback (Crucial for the 'D' shortcut fix)
      toast.warning(
        `Diff requires ${DIFF_REQUIRED_SELECTION} pages`,
        `You have ${store.selectedCount} selected. Select exactly ${DIFF_REQUIRED_SELECTION} pages to compare.`,
      )
      return
    }

    // 3. Execute
    const selectedIds = Array.from(store.selection.selectedIds)
    const pageA = store.contentPages.find((p) => p.id === selectedIds[0])
    const pageB = store.contentPages.find((p) => p.id === selectedIds[1])

    if (pageA && pageB) {
      ui.openDiffModal(pageA, pageB)
    }
  }

  // ============================================
  // Redactions
  // ============================================

  function addRedaction(pageId: string, redaction: RedactionMark) {
    execute(new AddRedactionCommand(pageId, [redaction]))
  }

  function updateRedaction(pageId: string, previous: RedactionMark, next: RedactionMark) {
    execute(new UpdateRedactionCommand(pageId, previous, next))
  }

  function deleteRedaction(pageId: string, redaction: RedactionMark) {
    execute(new DeleteRedactionCommand(pageId, redaction))
  }

  function deleteRedactions(pageId: string, redactions: RedactionMark[]) {
    if (!redactions || redactions.length === 0) return
    if (redactions.length === 1) {
      const first = redactions[0]
      if (!first) return
      execute(new DeleteRedactionCommand(pageId, first))
      return
    }
    const commands = redactions.map((redaction) => new DeleteRedactionCommand(pageId, redaction))
    execute(new BatchCommand(commands, `Delete ${redactions.length} redactions`))
  }

  // ============================================
  // Preflight Fixes
  // ============================================

  function applyPreflightFix(fix: PreflightFix, pageIds: string[]) {
    if (!fix) return

    switch (fix.id) {
      case 'resize': {
        if (!fix.targets || fix.targets.length === 0) return
        execute(new ResizePagesCommand(fix.targets))
        break
      }
      case 'rotate': {
        if (!pageIds || pageIds.length === 0) return
        execute(new RotatePagesCommand(pageIds, fix.rotation))
        break
      }
      case 'edit-metadata': {
        ui.setInspectorTab('metadata')
        break
      }
      default:
        break
    }
  }

  // ============================================
  // Source Management
  // ============================================

  /**
   * Handle remove source file action
   */
  async function handleRemoveSource(sourceId: string) {
    const source = store.sources.get(sourceId)
    if (!source) return

    const relatedPages = store.contentPages.filter((p) => p.sourceFileId === sourceId)

    if (!isMobile.value) {
      const confirmed = await confirmDelete(relatedPages.length, 'page')
      if (!confirmed) return
    }

    execute(new RemoveSourceCommand(source, store.pages))

    toast.success('File removed', undefined, {
      label: 'UNDO',
      onClick: () => undo(),
    })
  }

  // ============================================
  // Project Management
  // ============================================

  function resetWorkspaceUi() {
    ui.closeCommandPalette()
    ui.closePreflightPanel()
    ui.closeExportModal()
    ui.closePreviewModal()
    ui.closeDiffModal()
  }

  /**
   * Clear current project contents (sources, pages, metadata, history)
   */
  async function handleClearProject() {
    const confirmed = await confirm({
      title: 'Clear project?',
      message: 'This will remove all files, metadata, and history from this project.',
      confirmText: 'Clear Project',
      variant: 'danger',
    })
    if (!confirmed) return

    resetWorkspaceUi()
    store.reset()
    clearHistory()

    toast.success('Project cleared')

    try {
      await projects.persistActiveProject()
    } catch (error) {
      console.error('Failed to persist cleared project:', error)
      toast.error('Failed to save cleared project')
    }
  }

  /**
   * Delete current project and return to dashboard
   */
  async function handleDeleteProject() {
    const projectId = activeProjectId.value
    if (!projectId) {
      toast.error('No active project to delete')
      return
    }

    const projectTitle = normalizeProjectTitle(activeProjectMeta.value?.title ?? store.projectTitle)

    const confirmed = await confirm({
      title: `Move "${projectTitle}" to trash?`,
      message: 'You can restore this project later from the Trash view.',
      confirmText: 'Move to Trash',
      variant: 'warning',
    })
    if (!confirmed) return

    await projects.trashProject(projectId)
    toast.success('Project moved to trash')
    await router.push('/')
  }

  /**
   * Handle new project action (clears workspace)
   */
  async function handleNewProject() {
    const confirmed = await confirm({
      title: 'Start a new project?',
      message: 'Your current project will be saved automatically before switching.',
      confirmText: 'Create Project',
      variant: 'info',
    })
    if (!confirmed) return
    const project = await projects.createProject({ title: DEFAULT_PROJECT_TITLE })
    toast.success('New project created')
    await router.push(`/project/${project.id}`)
  }

  // ============================================
  // Context Menu Actions
  // ============================================

  /**
   * Handle context menu action on a page
   */
  function handleContextAction(action: UserAction, pageRef: PageReference) {
    // Ensure the page is selected before acting
    if (!store.selection.selectedIds.has(pageRef.id)) {
      store.selectPage(pageRef.id, false)
    }

    switch (action) {
      case UserAction.PREVIEW:
        handlePagePreview(pageRef)
        break
      case UserAction.DUPLICATE:
        handleDuplicateSelected()
        break
      case UserAction.ROTATE_LEFT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.LEFT)
        break
      case UserAction.ROTATE_RIGHT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.RIGHT)
        break
      case UserAction.SELECT_ALL:
        store.selectAll()
        break
      case UserAction.EXPORT_SELECTED:
        handleExportSelected()
        break
      case UserAction.DELETE:
        handleDeleteSelected()
        break
      case UserAction.DIFF:
        handleDiffSelected()
        break
      default:
        break
    }
  }

  /**
   * Handle command palette action
   */
  function handleCommandAction(action: UserAction) {
    ui.closeCommandPalette()

    switch (action) {
      case UserAction.ADD_FILES:
        openFileDialog()
        break
      case UserAction.EXPORT:
        handleExport()
        break
      case UserAction.EXPORT_SELECTED:
        handleExportSelected()
        break
      case UserAction.DELETE:
        handleDeleteSelected()
        break
      case UserAction.DUPLICATE:
        handleDuplicateSelected()
        break
      case UserAction.ROTATE_LEFT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.LEFT)
        break
      case UserAction.ROTATE_RIGHT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.RIGHT)
        break
      case UserAction.NEW_PROJECT:
        handleNewProject()
        break
      case UserAction.DIFF:
        handleDiffSelected()
        break
      case UserAction.PREVIEW:
        if (store.selectedCount === 1) {
          const id = Array.from(store.selection.selectedIds)[0]
          const page = store.contentPages.find((p) => p.id === id)
          if (page) handlePagePreview(page)
        }
        break
      case UserAction.SELECT_ALL:
        store.selectAll()
        break
      default:
        break
    }
  }

  // ============================================
  // Mobile-Specific Actions
  // ============================================

  /**
   * Handle mobile add files action
   */
  function handleMobileAddFiles() {
    openFileDialog()
  }

  /**
   * Handle mobile take photo action
   */
  function handleMobileTakePhoto() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files) handleImport(files, { addPages: true })
    }
    input.click()
  }

  // ============================================
  // Zoom Actions
  // ============================================

  function zoomIn() {
    ui.zoomIn()
  }

  function zoomOut() {
    ui.zoomOut()
  }

  // ============================================
  // Selection + UI State
  // ============================================

  function selectPage(pageId: string, addToSelection = false) {
    store.selectPage(pageId, addToSelection)
  }

  function togglePageSelection(pageId: string) {
    store.togglePageSelection(pageId)
    // Auto-exit selection mode when no pages selected
    if (isMobile.value && store.selectedCount === 0) {
      ui.exitMobileSelectionMode()
    }
  }

  function selectRange(fromId: string, toId: string) {
    store.selectRange(fromId, toId)
  }

  function selectAllPages() {
    store.selectAll()
    if (isMobile.value) {
      haptic('light')
    }
  }

  function clearSelection() {
    store.clearSelection()
    if (isMobile.value) {
      haptic('light')
      ui.exitMobileSelectionMode()
    }
  }

  function clearSelectionKeepMode() {
    store.clearSelection()
    if (isMobile.value) {
      haptic('light')
    }
  }

  function enterMobileSelectionMode() {
    ui.enterMobileSelectionMode()
  }

  function exitMobileSelectionMode() {
    ui.exitMobileSelectionMode()
    store.clearSelection()
  }

  function enterMobileMoveMode() {
    if (store.selectedCount === 0) return
    ui.enterMobileMoveMode()
    haptic('medium')
  }

  function exitMobileMoveMode() {
    ui.exitMobileMoveMode()
  }

  function enterMobileSplitMode() {
    if (isMobile.value) {
      haptic('medium')
    }
    exitMobileSelectionMode()
    ui.setCurrentTool('razor')
  }

  function exitMobileSplitMode() {
    ui.setCurrentTool('select')
  }

  /**
   * Handle moving selected pages to a new position (mobile Move mode)
   */
  function handleMoveSelectedToPosition(targetIndex: number) {
    if (store.selectedCount === 0) return

    const selectedIds = new Set(store.selection.selectedIds)
    const allPages = store.pages
    const selectedPages = allPages.filter((p) => selectedIds.has(p.id))
    const otherPages = allPages.filter((p) => !selectedIds.has(p.id))

    // Calculate adjusted index accounting for removed selected items
    let adjustedIndex = targetIndex
    for (let i = 0; i < targetIndex && i < allPages.length; i++) {
      const page = allPages[i]
      if (page && selectedIds.has(page.id)) {
        adjustedIndex--
      }
    }

    // Build new order
    const newOrder = [
      ...otherPages.slice(0, adjustedIndex),
      ...selectedPages,
      ...otherPages.slice(adjustedIndex),
    ]

    const isSameOrder =
      newOrder.length === allPages.length &&
      newOrder.every((page, index) => page.id === allPages[index]?.id)

    if (isSameOrder) {
      ui.exitMobileMoveMode()
      return
    }

    handleReorderPages([...allPages], newOrder)
    haptic('light')
    ui.exitMobileMoveMode()
  }

  // ============================================
  // Project / Metadata / Security
  // ============================================

  function setProjectTitleDraft(value: string) {
    if (store.isTitleLocked) return
    store.setProjectTitle(value)
  }

  function commitProjectTitle(value?: string) {
    if (store.isTitleLocked) return
    store.setProjectTitle(normalizeProjectTitle(value ?? store.projectTitle))
  }

  function setCurrentTool(tool: 'select' | 'razor') {
    ui.setCurrentTool(tool)
  }

  function setMetadata(next: Partial<DocumentMetadata>) {
    store.setMetadata(next)
  }

  function applyMetadataFromSource(sourceId: string) {
    const source = store.sources.get(sourceId)
    if (!source?.metadata) return
    store.setMetadata(source.metadata)
  }

  function addKeyword(keyword: string) {
    store.addKeyword(keyword)
  }

  function removeKeyword(keyword: string) {
    store.removeKeyword(keyword)
  }

  function setSecurity(next: Partial<SecurityMetadata>) {
    store.setSecurity(next)
  }

  function updateOutlineTree(
    nextTree: OutlineNode[],
    options?: { name?: string; nextDirty?: boolean },
  ) {
    const previousTree = store.outlineTree
    const previousDirty = store.outlineDirty
    const name = options?.name ?? 'Update outline'
    const nextDirty = options?.nextDirty ?? true
    execute(new UpdateOutlineCommand(previousTree, nextTree, previousDirty, nextDirty, name))
  }

  function createOutlineNodeForPage(pageId: string, title = 'New Bookmark'): OutlineNode {
    return {
      id: crypto.randomUUID(),
      parentId: null,
      title,
      expanded: true,
      dest: {
        type: 'page',
        targetPageId: pageId,
        fit: 'Fit',
      },
      children: [],
    }
  }

  function addOutlineNodeForPage(pageId: string, title?: string) {
    const node = createOutlineNodeForPage(pageId, title ?? 'New Bookmark')
    updateOutlineTree([...store.outlineTree, node], { name: 'Add outline node' })
  }

  function renameOutlineNode(nodeId: string, title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    updateOutlineTree(setOutlineNodeTitle(store.outlineTree, nodeId, trimmed), {
      name: 'Rename outline node',
    })
  }

  function setOutlineNodeTarget(nodeId: string, targetPageId: string) {
    updateOutlineTree(
      setOutlineNodeDest(store.outlineTree, nodeId, {
        type: 'page',
        targetPageId,
        fit: 'Fit',
      }),
      { name: 'Set outline target' },
    )
  }

  function setOutlineNodeUrl(nodeId: string, url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    updateOutlineTree(
      setOutlineNodeDest(store.outlineTree, nodeId, {
        type: 'external-url',
        url: trimmed,
      }),
      { name: 'Set outline URL' },
    )
  }

  function clearOutlineNodeTarget(nodeId: string) {
    updateOutlineTree(setOutlineNodeDest(store.outlineTree, nodeId, { type: 'none' }), {
      name: 'Clear outline target',
    })
  }

  function updateOutlineNodeStyle(
    nodeId: string,
    style: { color?: string; isBold?: boolean; isItalic?: boolean },
  ) {
    updateOutlineTree(setOutlineNodeStyle(store.outlineTree, nodeId, style), {
      name: 'Update outline style',
    })
  }

  function deleteOutlineNode(nodeId: string) {
    updateOutlineTree(removeOutlineNode(store.outlineTree, nodeId, 'node'), {
      name: 'Remove outline node',
    })
  }

  function deleteOutlineBranch(nodeId: string) {
    updateOutlineTree(removeOutlineNode(store.outlineTree, nodeId, 'branch'), {
      name: 'Remove outline branch',
    })
  }

  function toggleOutlineExpanded(nodeId: string, expanded: boolean) {
    const nextTree = setOutlineNodeExpanded(store.outlineTree, nodeId, expanded)
    store.setOutlineTree(nextTree, false)
  }

  function resetOutlineToFileStructure() {
    const nextTree = autoGenOutlineFromPages(store.contentPages as PageReference[], store.sources)
    updateOutlineTree(nextTree, { name: 'Reset outline', nextDirty: false })
  }

  function cleanBrokenOutlineNodes() {
    const validPageIds = new Set(store.contentPages.map((p) => p.id))
    const nextTree = removeBrokenOutlineTargets(store.outlineTree, validPageIds)
    updateOutlineTree(nextTree, { name: 'Clean broken outline links' })
  }

  function beginOutlineTargeting(nodeId: string) {
    ui.beginOutlineTargeting(nodeId)
  }

  function completeOutlineTargeting(targetPageId: string): boolean {
    const nodeId = ui.outlineTargetNodeId
    if (!nodeId) return false
    ui.endOutlineTargeting()
    setOutlineNodeTarget(nodeId, targetPageId)
    toast.success('Outline target updated')
    return true
  }

  return {
    // File Handling
    handleFileInputChange,
    handleFilesSelected,
    handleSourcesSelected,
    handleSourceDropped,
    handleSourcePageDropped,
    handleSourcePagesDropped,

    // Export
    handleExport,
    handleExportSelected,
    handleExportSuccess,
    openExportOptions,
    exportDocument,
    exportJob,
    getSuggestedFilename,
    getEstimatedSize,
    clearExportError,
    parsePageRange,
    validatePageRange,

    // Page Actions
    handlePagePreview,
    handleClosePreview,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRotateSelected,
    handleDiffSelected,
    applyPreflightFix,
    addRedaction,
    updateRedaction,
    deleteRedaction,
    deleteRedactions,

    // Source Management
    handleRemoveSource,

    // Project Management
    handleClearProject,
    handleDeleteProject,
    handleNewProject,

    // Context/Command Actions
    handleContextAction,
    handleCommandAction,

    // Mobile Actions
    handleMobileAddFiles,
    handleMobileTakePhoto,

    // Zoom
    zoomIn,
    zoomOut,

    // History (Command Manager)
    undo,
    redo,
    canUndo,
    canRedo,
    undoName,
    redoName,
    historyList,
    jumpTo,

    // Undoable structure changes
    handleReorderPages,
    handleSplitGroup,

    // Selection + UI State
    selectPage,
    togglePageSelection,
    selectRange,
    selectAllPages,
    clearSelection,
    clearSelectionKeepMode,
    enterMobileSelectionMode,
    exitMobileSelectionMode,
    enterMobileMoveMode,
    exitMobileMoveMode,
    enterMobileSplitMode,
    exitMobileSplitMode,
    handleMoveSelectedToPosition,

    // Project / Metadata / Security
    setProjectTitleDraft,
    commitProjectTitle,
    setCurrentTool,
    setMetadata,
    applyMetadataFromSource,
    addKeyword,
    removeKeyword,
    setSecurity,
    updateOutlineTree,
    addOutlineNodeForPage,
    renameOutlineNode,
    setOutlineNodeTarget,
    setOutlineNodeUrl,
    clearOutlineNodeTarget,
    updateOutlineNodeStyle,
    deleteOutlineNode,
    deleteOutlineBranch,
    toggleOutlineExpanded,
    resetOutlineToFileStructure,
    cleanBrokenOutlineNodes,
    beginOutlineTargeting,
    completeOutlineTargeting,
  }
}

export type DocumentActions = ReturnType<typeof useDocumentActions>

const documentActionsKey: InjectionKey<DocumentActions> = Symbol('document-actions')

export function provideDocumentActions(actions: DocumentActions) {
  provide(documentActionsKey, actions)
}

export function useDocumentActionsContext(): DocumentActions {
  const actions = inject(documentActionsKey)
  if (!actions) {
    throw new Error('useDocumentActionsContext must be used within EditorView provider')
  }
  return actions
}
