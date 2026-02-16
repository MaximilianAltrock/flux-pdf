import { defineStore } from 'pinia'
import { createWorkflowService } from '@/domains/workspace/application/workflow.service'

export const useWorkflowsStore = defineStore('workflows', () => {
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
})
