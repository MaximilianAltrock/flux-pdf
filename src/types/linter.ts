import type { RotationDelta } from '@/constants'

export type Severity = 'error' | 'warning' | 'info'

export type ResizeFixTarget = {
  pageId: string
  targetDimensions: { width: number; height: number }
}

export type PreflightFix =
  | {
      id: 'resize'
      label: string
      targets: ResizeFixTarget[]
    }
  | {
      id: 'rotate'
      label: string
      rotation: RotationDelta
    }
  | {
      id: 'edit-metadata'
      label: string
    }

export interface LintResult {
  ruleId: string
  severity: Severity
  message: string
  pageIds: string[]
  fix?: PreflightFix
}
