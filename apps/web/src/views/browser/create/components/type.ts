export interface WindowMetaData {
  projectName?: string
  projectId?: number
  labelIds?: (number | string)[]
  windowRemark?: string
  projectDefault?: number
}

export interface Accordions {
  value: string[]
  panels: FormPanel[]
}

export interface FormPanel {
  title?: string
  value: string
  groupIndex: number
  /** 同一手风琴面板内追加渲染的 inputsGroup 下标（如基础设置合并窗口剩余字段 + 原 basicInputs） */
  extraGroupIndexes?: number[]
  placement: 'outside' | 'accordion'
  variant?: 'window' | 'settings'
  excludedFields?: string[]
}

/** 单创/编辑顶部基础信息占用的窗口组字段，手风琴侧需排除 */
export const SINGLE_BASIC_INFO_FIELDS = ['windowName', 'proxyInfoList', 'windowPlatformList', 'cookie'] as const
