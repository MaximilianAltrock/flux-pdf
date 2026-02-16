import { describe, expect, it } from 'vitest'
import { createWorkflowService, type WorkflowRepository } from '@/domains/workspace/application/workflow.service'
import type { Workflow, WorkflowStep } from '@/shared/types/workflow'

function createWorkflow(id: string, updatedAt: number, steps: WorkflowStep[] = []): Workflow {
  return {
    id,
    name: `Workflow ${id}`,
    icon: 'workflow',
    description: '',
    steps,
    createdAt: updatedAt,
    updatedAt,
  }
}

function createRepository(seed: Workflow[] = []): WorkflowRepository {
  const workflows = new Map(seed.map((workflow) => [workflow.id, workflow]))

  return {
    listByUpdatedAtDesc: async () =>
      Array.from(workflows.values()).sort((a, b) => b.updatedAt - a.updatedAt),
    get: async (id) => workflows.get(id),
    put: async (workflow) => {
      workflows.set(workflow.id, workflow)
    },
    delete: async (id) => {
      workflows.delete(id)
    },
  }
}

describe('workflow.service', () => {
  it('limits workflow listing when a limit is provided', async () => {
    const repository = createRepository([
      createWorkflow('w1', 100),
      createWorkflow('w2', 300),
      createWorkflow('w3', 200),
    ])
    const service = createWorkflowService(repository)

    const workflows = await service.listWorkflows(2)

    expect(workflows).toHaveLength(2)
    expect(workflows.map((workflow) => workflow.id)).toEqual(['w2', 'w3'])
  })

  it('normalizes values on create and clones mutable step params', async () => {
    const repository = createRepository()
    const service = createWorkflowService(repository)
    const inputSteps: WorkflowStep[] = [
      {
        id: 'step-1',
        label: 'Rotate',
        commandType: 'rotate',
        params: { nested: { degrees: 90 } },
      },
    ]

    const created = await service.createWorkflow({
      name: '   ',
      description: '  description  ',
      icon: '   ',
      steps: inputSteps,
    })

    expect(created.name).toBe('Untitled Workflow')
    expect(created.icon).toBe('workflow')
    expect(created.description).toBe('description')
    expect(created.steps).toHaveLength(1)
    expect(created.steps[0]).not.toBe(inputSteps[0])

    const inputStep = inputSteps[0]
    const createdStep = created.steps[0]
    if (!inputStep || !createdStep) {
      throw new Error('Expected workflow steps to exist')
    }

    ;(inputStep.params as { nested?: { degrees?: number } }).nested!.degrees = 180
    expect((createdStep.params as { nested?: { degrees?: number } }).nested?.degrees).toBe(90)
  })

  it('returns null for update/duplicate on unknown workflow', async () => {
    const repository = createRepository()
    const service = createWorkflowService(repository)

    await expect(service.updateWorkflow('missing', { name: 'x' })).resolves.toBeNull()
    await expect(service.duplicateWorkflow('missing')).resolves.toBeNull()
  })

  it('renames and deletes workflows', async () => {
    const base = createWorkflow('w1', Date.now())
    const repository = createRepository([base])
    const service = createWorkflowService(repository)

    const renamed = await service.renameWorkflow('w1', 'Renamed')
    expect(renamed?.name).toBe('Renamed')

    await service.deleteWorkflow('w1')
    await expect(service.getWorkflow('w1')).resolves.toBeUndefined()
  })
})
