export interface MetaData {
  projectName?: string
  projectId: number | undefined
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
