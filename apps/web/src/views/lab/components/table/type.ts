import type { SortOrderNumber } from '/@/utils'

/** lab table 服务端排序：与 filters 一起在首屏由父级注入初始状态 */
export interface LabTableSortState {
  sortField: string
  sortOrder: SortOrderNumber
}

export interface LabTableSortInit {
  data?: Partial<LabTableSortState>
  onChange?: (state: LabTableSortState) => void | Promise<void>
}

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
