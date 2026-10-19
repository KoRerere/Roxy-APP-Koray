import type { Component } from 'vue'
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

/** 行菜单看 row，批量菜单看 rows，避免再拆一套 tableOperation */
export interface LabTableActionScope {
  row?: any
  rows?: any[]
}

export interface ActionsItemMultiple {
  /** 快捷区分组名，按名字排序；同一组画在一个块里 */
  name?: string
  /** 快捷区同时显示文案，对应旧条「打开窗口」这类按钮 */
  showLabel?: boolean
  iconProps?: Record<string, any>
  discountBadge?: string
  render?: Component
  [key: string]: any
}

export interface ActionsItem {
  key?: string
  icon?: any
  label?: string
  /** 出现在行内快捷区 */
  quick?: boolean
  disabled?: boolean
  disabledTooltip?: string
  separator?: boolean
  /** 只出现在行内快捷区，不进入右键菜单 */
  onlyQuick?: boolean
  /** 只出现在批量条，不进入行菜单 */
  onlyMultiple?: boolean
  /**
   * 对齐 PrimeVue MenuItem.visible，只决定这项在菜单里显不显示。
   * 快捷区和批量条不受这个字段影响。
   */
  visible?: boolean | (() => boolean)
  /**
   * 权限。false 或函数返回 false 时，这项操作不存在。
   * 表格只读结果，不改传入的原对象。
   */
  power?: boolean | (() => boolean)
  command?: (event: any) => any
  items?: ActionsItem[]
  suffixLabel?: string
  suffixIcon?: any
  suffixLabelClass?: string
  iconClass?: string
  menuTooltip?: string
  /**
   * true：进入批量更多菜单，不进快捷区。
   * 对象：同时进快捷区（分组/文案/角标）和更多菜单。
   */
  multiple?: boolean | ActionsItemMultiple
  [key: string]: any
}

/** 静态菜单，或按当前行/选中集现算 */
export type LabTableModel = ActionsItem[] | ((scope: LabTableActionScope) => ActionsItem[])

/**
 * 外围是否出现。
 * actions：true 为快捷按钮加更多，quick 只留快捷按钮，false 不插入操作列。
 */
export interface LabTableChrome {
  header?: boolean
  reload?: boolean
  paginator?: boolean
  actions?: boolean | 'quick'
  selectionBar?: boolean
}

/** 列定义走 field/header/props，避免把渲染字段摊进 PrimeVue Column */
export interface LabTableColumn {
  field: string
  header?: string
  props?: Record<string, any>
  cellProps?: Record<string, any>
  headerRender?: Component
  headerSlot?: string
  render?: Component
  slot?: string
  getText?: (row: any) => string
  skeleton?: Record<string, any>
  disabledToggle?: boolean
  _visible?: boolean
  _sort?: number
  _cache?: unknown
}
