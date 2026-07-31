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
  placement: 'outside' | 'accordion'
  variant?: 'window' | 'settings'
  excludedFields?: string[]
}
