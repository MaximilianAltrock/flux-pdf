import type { Ref } from 'vue'

export type DocumentUiState = {
  zoom: Ref<number>
  setZoom: (level: number) => void
  setLoading: (loading: boolean, message?: string) => void
  ignoredPreflightRuleIds: Ref<string[]>
  setIgnoredPreflightRuleIds: (ids: string[]) => void
}
