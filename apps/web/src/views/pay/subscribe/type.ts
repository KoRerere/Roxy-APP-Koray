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

export interface Duration {
  key: string
  due: string
  day: number
  month: number
  title: string
  discount: number
  discountStr?: string
  label?: string
  [key: string]: any
}
