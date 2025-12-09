/**
 * Global User Actions Enum
 * Used for event emitting and command palette matching
 */
export enum UserAction {
  // Page Manipulation
  ROTATE_LEFT = 'rotate-left',
  ROTATE_RIGHT = 'rotate-right',
  DELETE = 'delete',
  DUPLICATE = 'duplicate',

  // File / Project
  EXPORT = 'export',
  EXPORT_SELECTED = 'export-selected',
  NEW_PROJECT = 'new-project',
  ADD_FILES = 'add-files',

  // Selection
  SELECT_ALL = 'select-all',
  PREVIEW = 'preview',
}
