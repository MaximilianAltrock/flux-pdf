import { createWorkflowService } from '@/domains/workflows/application/workflow.service'

export function useWorkflowLibrary() {
  const workflowService = createWorkflowService()

  return {
    listWorkflows: workflowService.listWorkflows,
    getWorkflow: workflowService.getWorkflow,
    createWorkflow: workflowService.createWorkflow,
    updateWorkflow: workflowService.updateWorkflow,
    renameWorkflow: workflowService.renameWorkflow,
    duplicateWorkflow: workflowService.duplicateWorkflow,
    deleteWorkflow: workflowService.deleteWorkflow,
  }
}
