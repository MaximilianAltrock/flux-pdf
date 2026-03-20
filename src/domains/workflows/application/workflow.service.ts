import { db } from '@/shared/infrastructure/db'
import type { Workflow, WorkflowStep } from '@/shared/types/workflow'

const DEFAULT_WORKFLOW_NAME = 'Untitled Workflow'
const DEFAULT_WORKFLOW_ICON = 'workflow'

export interface WorkflowRepository {
  listByUpdatedAtDesc: () => Promise<Workflow[]>
  get: (id: string) => Promise<Workflow | undefined>
  put: (workflow: Workflow) => Promise<unknown>
  delete: (id: string) => Promise<void>
}

function normalizeName(name: string | undefined): string {
  const next = String(name ?? '').trim()
  return next.length > 0 ? next : DEFAULT_WORKFLOW_NAME
}

function normalizeDescription(description: string | undefined): string {
  return String(description ?? '').trim()
}

function normalizeIcon(icon: string | undefined): string {
  return String(icon ?? DEFAULT_WORKFLOW_ICON).trim() || DEFAULT_WORKFLOW_ICON
}

function cloneSteps(steps: ReadonlyArray<WorkflowStep>): WorkflowStep[] {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    commandType: step.commandType,
    params: JSON.parse(JSON.stringify(step.params)),
  }))
}

export function createWorkflowRepository(): WorkflowRepository {
  return {
    listByUpdatedAtDesc: async () => db.workflows.orderBy('updatedAt').reverse().toArray(),
    get: async (id) => db.workflows.get(id),
    put: async (workflow) => db.workflows.put(workflow),
    delete: async (id) => {
      await db.workflows.delete(id)
    },
  }
}

export function createWorkflowService(repository: WorkflowRepository = createWorkflowRepository()) {
  async function listWorkflows(limit = 0): Promise<Workflow[]> {
    const workflows = await repository.listByUpdatedAtDesc()
    if (limit > 0) return workflows.slice(0, limit)
    return workflows
  }

  async function getWorkflow(id: string): Promise<Workflow | undefined> {
    return repository.get(id)
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
      icon: normalizeIcon(options.icon),
      description: normalizeDescription(options.description),
      steps: cloneSteps(options.steps),
      createdAt: now,
      updatedAt: now,
    }

    await repository.put(workflow)
    return workflow
  }

  async function updateWorkflow(
    id: string,
    updates: Partial<Pick<Workflow, 'name' | 'description' | 'icon' | 'steps'>>,
  ): Promise<Workflow | null> {
    const existing = await repository.get(id)
    if (!existing) return null

    const updated: Workflow = {
      ...existing,
      name: updates.name !== undefined ? normalizeName(updates.name) : existing.name,
      description:
        updates.description !== undefined
          ? normalizeDescription(updates.description)
          : existing.description,
      icon: updates.icon !== undefined ? normalizeIcon(updates.icon) : existing.icon,
      steps: updates.steps ? cloneSteps(updates.steps) : existing.steps,
      updatedAt: Date.now(),
    }

    await repository.put(updated)
    return updated
  }

  async function renameWorkflow(id: string, name: string): Promise<Workflow | null> {
    return updateWorkflow(id, { name })
  }

  async function duplicateWorkflow(id: string): Promise<Workflow | null> {
    const existing = await repository.get(id)
    if (!existing) return null

    return createWorkflow({
      name: `${existing.name} Copy`,
      description: existing.description,
      icon: existing.icon,
      steps: existing.steps,
    })
  }

  async function deleteWorkflow(id: string): Promise<void> {
    await repository.delete(id)
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
}
