export interface ActionsItem {
  key?: string | number
  icon?: any
  quick?: boolean
  multiple?: {
    name?: string
    showLabel?: boolean
    iconProps?: Record<string, any>
    [key: string]: any
  }
  [key: string]: any
}
