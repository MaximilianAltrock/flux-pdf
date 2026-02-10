export const WorkflowActionType = {
  ROTATE_ALL: 'workflow.rotate_all',
  ROTATE_EVEN: 'workflow.rotate_even',
  ROTATE_ODD: 'workflow.rotate_odd',
  DELETE_FIRST_PAGE: 'workflow.delete_first_page',
  DELETE_LAST_PAGE: 'workflow.delete_last_page',
} as const

export type WorkflowActionTypeValue =
  (typeof WorkflowActionType)[keyof typeof WorkflowActionType]

export function isWorkflowActionType(value: string): value is WorkflowActionTypeValue {
  return Object.values(WorkflowActionType).includes(value as WorkflowActionTypeValue)
}
