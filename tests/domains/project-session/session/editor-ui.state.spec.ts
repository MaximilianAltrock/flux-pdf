import { describe, expect, it } from 'vitest'
import { ZOOM } from '@/shared/constants'
import {
  EDITOR_APP_GLOBAL_UI_FIELDS,
  EDITOR_SESSION_SCOPED_UI_FIELDS,
  createEditorUiState,
} from '@/domains/project-session/session/editor-ui.state'

describe('editor session ui state', () => {
  it('freezes the session-scoped and app-global ui split', () => {
    expect(EDITOR_SESSION_SCOPED_UI_FIELDS).toEqual([
      'zoom',
      'currentTool',
      'inspectorTab',
      'preview',
      'diff',
      'mobileMode',
      'preflightIgnoredRules',
    ])
    expect(EDITOR_APP_GLOBAL_UI_FIELDS).toEqual([])
  })

  it('manages zoom, preview, diff, mobile mode, and preflight state per session', () => {
    const ui = createEditorUiState()

    ui.setZoom(ZOOM.MAX + 100)
    expect(ui.zoom).toBe(ZOOM.MAX)

    ui.zoomOut()
    expect(ui.zoom).toBe(ZOOM.MAX - ZOOM.STEP)

    ui.enterMobileSelectionMode()
    expect(ui.mobileMode).toBe('select')

    ui.enterMobileMoveMode()
    expect(ui.mobileMode).toBe('move')

    ui.exitMobileSelectionMode()
    expect(ui.mobileMode).toBe('browse')

    const pageA = {
      id: 'page-a',
      sourceFileId: 'source-1',
      sourcePageIndex: 0,
      rotation: 0,
    }
    const pageB = {
      id: 'page-b',
      sourceFileId: 'source-1',
      sourcePageIndex: 1,
      rotation: 0,
    }

    ui.openPreviewModal(pageA)
    expect(ui.showPreviewModal).toBe(true)
    expect(ui.previewPageRef).toEqual(pageA)

    ui.openDiffModal(pageA, pageB)
    expect(ui.showDiffModal).toBe(true)
    expect(ui.diffPages).toEqual([pageA, pageB])

    ui.ignorePreflightRule('metadata-missing')
    ui.ignorePreflightRule('metadata-missing')
    expect(ui.ignoredPreflightRuleIds).toEqual(['metadata-missing'])

    ui.closePreviewModal()
    ui.closeDiffModal()
    ui.resetIgnoredPreflightRules()

    expect(ui.showPreviewModal).toBe(false)
    expect(ui.previewPageRef).toBeNull()
    expect(ui.showDiffModal).toBe(false)
    expect(ui.diffPages).toBeNull()
    expect(ui.ignoredPreflightRuleIds).toEqual([])
  })
})
