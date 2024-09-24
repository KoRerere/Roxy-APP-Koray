export interface MetaData {
  projectName?: string
  projectId: string
  labelIds: number[]
  windowRemark: string
}

export interface Accordions {
  value: string[]
  panels: {
    title: string
    value: string
  }[]
}
