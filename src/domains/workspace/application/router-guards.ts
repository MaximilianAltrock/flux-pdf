import type { ProjectMeta } from '@/shared/infrastructure/db'

export function normalizeProjectIdParam(param: unknown): string | null {
  const raw = Array.isArray(param) ? param[0] : param
  if (typeof raw !== 'string') return null
  const normalized = raw.trim()
  return normalized.length > 0 ? normalized : null
}

export function isAccessibleProject(
  project: Pick<ProjectMeta, 'trashedAt'> | null | undefined,
): boolean {
  return Boolean(project && !project.trashedAt)
}
