import type { PageReference } from '@/types'
import type { RotationDelta } from '@/constants'

// === 1. Enums (Single Source of Truth) ===
export enum PreflightRuleId {
  SIZE = 'size-mismatch',
  ORIENTATION = 'orientation-mismatch',
  HEAVY = 'heavy-pages',
  LOW_QUALITY = 'low-quality',
  METADATA = 'metadata-title',
}

export enum PreflightFixId {
  RESIZE = 'resize',
  ROTATE = 'rotate',
  EDIT_METADATA = 'edit-metadata',
}

// === 2. Severity Levels ===
export type Severity = 'error' | 'warning' | 'info'

// === 3. Fix Data Shapes ===
export type ResizeFixTarget = {
  pageId: string
  targetDimensions: { width: number; height: number }
}

export type PreflightFix =
  | {
      id: PreflightFixId.RESIZE
      label: string
      targets: ResizeFixTarget[]
    }
  | {
      id: PreflightFixId.ROTATE
      label: string
      rotation: RotationDelta
    }
  | {
      id: PreflightFixId.EDIT_METADATA
      label: string
    }

// === 4. Result Interface ===
export interface LintResult {
  ruleId: string // Matches PreflightRuleId
  severity: Severity
  message: string
  pageIds: string[]
  fix?: PreflightFix
}

// === 5. Rule Definition Interface ===
export interface LintRule {
  id: string
  label: string
  check: (pages: PageReference[]) => LintResult[]
}
