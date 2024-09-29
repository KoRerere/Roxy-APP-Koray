import type { UserGetUserConfigListData } from '@roxy/backend-api'

export type UserConfig = UserGetUserConfigListData['data']

export interface Items {
  label?: string
  text?: string
  name?: string
  value?: any
  classes?: string
  props?: any
  component?: any
}
export interface List {
  subtitle?: string
  items: Items[]
}
export interface SettingsModule {
  title: string
  description: string
  list: List[]
}
