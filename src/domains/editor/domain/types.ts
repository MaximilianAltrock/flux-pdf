export const EDITOR_TOOLS = {
  SELECT: 'select',
  RAZOR: 'razor',
  TARGET: 'target',
} as const

export type EditorToolId = (typeof EDITOR_TOOLS)[keyof typeof EDITOR_TOOLS]

export const PRIMARY_EDITOR_TOOLS = [EDITOR_TOOLS.SELECT, EDITOR_TOOLS.RAZOR] as const
export type PrimaryEditorToolId = (typeof PRIMARY_EDITOR_TOOLS)[number]

export const MOBILE_EDITOR_MODES = {
  BROWSE: 'browse',
  SELECT: 'select',
  MOVE: 'move',
} as const

export type MobileEditorMode = (typeof MOBILE_EDITOR_MODES)[keyof typeof MOBILE_EDITOR_MODES]
