import type { Component } from 'vue'

export type SettingsCategoryItem = {
  id: string
  label: string
  description: string
  icon: Component
}

export type SettingsStorageSegmentView = {
  id: string
  label: string
  bytesLabel: string
  barClass: string
  dotClass: string
  widthPercent: number
}
