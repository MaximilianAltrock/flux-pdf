import { describe, expect, it } from 'vitest'
import {
  isAccessibleProject,
  normalizeProjectIdParam,
} from '@/domains/workspace/application/router-guards'

describe('router guards helpers', () => {
  it('normalizes route param ids', () => {
    expect(normalizeProjectIdParam('project-1')).toBe('project-1')
    expect(normalizeProjectIdParam('  project-2  ')).toBe('project-2')
    expect(normalizeProjectIdParam(['project-3', 'project-4'])).toBe('project-3')
  })

  it('returns null for invalid route param ids', () => {
    expect(normalizeProjectIdParam('')).toBeNull()
    expect(normalizeProjectIdParam('   ')).toBeNull()
    expect(normalizeProjectIdParam(undefined)).toBeNull()
    expect(normalizeProjectIdParam(null)).toBeNull()
    expect(normalizeProjectIdParam(42)).toBeNull()
  })

  it('detects accessible projects', () => {
    expect(isAccessibleProject({ trashedAt: null })).toBe(true)
    expect(isAccessibleProject({ trashedAt: 12345 })).toBe(false)
    expect(isAccessibleProject(null)).toBe(false)
    expect(isAccessibleProject(undefined)).toBe(false)
  })
})
