export interface WindowMetaData {
  projectName?: string
  /** 项目 ID 为字符串，避免大整数经 Number() 丢精度 */
  projectId?: string
  labelIds?: string[]
  windowRemark?: string
  projectDefault?: number
}

export interface Accordions {
  value: string[]
  panels: FormPanel[]
}

export interface FormPanel {
  title?: string
  /** 标题旁的说明，悬停信息图标时展示 */
  tooltip?: string
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
