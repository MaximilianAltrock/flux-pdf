export interface WorkflowStep {
  id: string
  label: string
  commandType: string
  params: Record<string, unknown>
}

export interface Workflow {
  id: string
  name: string
  icon: string
  description: string
  steps: WorkflowStep[]
  createdAt: number
  updatedAt: number
}
