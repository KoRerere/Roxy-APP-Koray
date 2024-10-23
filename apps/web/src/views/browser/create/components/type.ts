export interface MetaData {
  projectName?: string
  projectId: number | undefined
  labelIds: (number | string)[] | undefined
  windowRemark: string | undefined
}

export interface Accordions {
  value: string[]
  panels: {
    title: string
    value: string
  }[]
}
