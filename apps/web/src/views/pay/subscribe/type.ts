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
  /** 该档计价乘数：短周期加价 × 时长/活动折扣，不含账户折扣 */
  rate: number
  /** 新人窗口买赠的额外天数，无活动时为 0 */
  giftDays?: number
  [key: string]: any
}
