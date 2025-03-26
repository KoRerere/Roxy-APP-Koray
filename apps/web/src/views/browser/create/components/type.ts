export interface WindowMetaData {
  projectName?: string
  projectId?: number
  labelIds?: (number | string)[]
  windowRemark?: string
  projectDefault?: number
}

export interface Accordions {
  value: string[]
  panels: {
    title: string
    value: string
  }[]
}
