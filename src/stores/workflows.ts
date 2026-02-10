import { defineStore } from 'pinia'
import { db } from '@/db/db'
import type { Workflow, WorkflowStep } from '@/types/workflow'

const DEFAULT_WORKFLOW_NAME = 'Untitled Workflow'
const DEFAULT_WORKFLOW_ICON = 'workflow'

function normalizeName(name: string | undefined): string {
  const next = String(name ?? '').trim()
  return next.length > 0 ? next : DEFAULT_WORKFLOW_NAME
}

function normalizeDescription(description: string | undefined): string {
  return String(description ?? '').trim()
}

function cloneSteps(steps: ReadonlyArray<WorkflowStep>): WorkflowStep[] {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    commandType: step.commandType,
    params: JSON.parse(JSON.stringify(step.params)),
  }))
}

export const useWorkflowsStore = defineStore('workflows', () => {
  async function listWorkflows(limit = 0): Promise<Workflow[]> {
    const workflows = await db.workflows.orderBy('updatedAt').reverse().toArray()
    if (limit > 0) return workflows.slice(0, limit)
    return workflows
  }

  async function getWorkflow(id: string): Promise<Workflow | undefined> {
    return db.workflows.get(id)
  }

  async function createWorkflow(options: {
    name: string
    description?: string
    icon?: string
    steps: WorkflowStep[]
  }): Promise<Workflow> {
    const now = Date.now()
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `workflow-${now}`

    const workflow: Workflow = {
      id,
      name: normalizeName(options.name),
      icon: String(options.icon ?? DEFAULT_WORKFLOW_ICON).trim() || DEFAULT_WORKFLOW_ICON,
      description: normalizeDescription(options.description),
      steps: cloneSteps(options.steps),
      createdAt: now,
      updatedAt: now,
    }

    await db.workflows.put(workflow)
    return workflow
  }

  async function updateWorkflow(
    id: string,
    updates: Partial<Pick<Workflow, 'name' | 'description' | 'icon' | 'steps'>>,
  ): Promise<Workflow | null> {
    const existing = await db.workflows.get(id)
    if (!existing) return null

    const updated: Workflow = {
      ...existing,
      name: updates.name !== undefined ? normalizeName(updates.name) : existing.name,
      description:
        updates.description !== undefined
          ? normalizeDescription(updates.description)
          : existing.description,
      icon:
        updates.icon !== undefined
          ? String(updates.icon).trim() || DEFAULT_WORKFLOW_ICON
          : existing.icon,
      steps: updates.steps ? cloneSteps(updates.steps) : existing.steps,
      updatedAt: Date.now(),
    }

    await db.workflows.put(updated)
    return updated
  }

  async function renameWorkflow(id: string, name: string): Promise<Workflow | null> {
    return updateWorkflow(id, { name })
  }

  async function duplicateWorkflow(id: string): Promise<Workflow | null> {
    const existing = await db.workflows.get(id)
    if (!existing) return null

    return createWorkflow({
      name: `${existing.name} Copy`,
      description: existing.description,
      icon: existing.icon,
      steps: existing.steps,
    })
  }

  async function deleteWorkflow(id: string): Promise<void> {
    await db.workflows.delete(id)
  }

  return {
    listWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    renameWorkflow,
    duplicateWorkflow,
    deleteWorkflow,
  }
})
