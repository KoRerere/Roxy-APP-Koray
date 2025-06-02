export interface Plan {
  subLevel: string
  minWindows: number
  maxWindows: number
  windowPrice: number
  logDays: number
  apiRate: number
  disabled?: boolean
  tierCount?: string
}
