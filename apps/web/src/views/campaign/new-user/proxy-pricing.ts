import currency from 'currency.js'
import { discountCalculate } from '/@/views/pay/subscribe/util'

/** 仅 30 天套用新人 IP 单价 */
export const NEW_USER_IP_DURATION_DAYS = 30

/** 新人首条 IP 计价入参 */
export interface NewUserProxyAmountInput {
  /** 当前类型 + 30 天且仍有剩余额度 */
  offerActive: boolean
  quantity: number
  /** 接口现价；无福利时整单按此 × 专属折扣 */
  unitPrice: number
  /** 划线/列表原价；第 2 条起按此 × 专属折扣，缺省则用 unitPrice */
  originalUnitPrice?: number
  newUserUnitPrice: number
  bandwidthAmount: number
  proxyDiscount: number
  isSpecialOffer?: boolean
}

/** 应付 / 原价 / 立省。无福利时与历史「全量 × 专属折扣」一致 */
export function calcProxyPayAmount(input: NewUserProxyAmountInput) {
  const qty = Math.max(1, input.quantity)
  const factor = input.isSpecialOffer ? 1 : discountCalculate([input.proxyDiscount])

  if (!input.offerActive) {
    const originalAmount = currency(input.unitPrice, { precision: 6 }).multiply(qty).add(input.bandwidthAmount).value
    const amount = currency(originalAmount, { precision: 6 }).multiply(factor).value
    return {
      amount,
      originalAmount,
      diffAmount: currency(originalAmount, { precision: 6 }).subtract(amount).value,
    }
  }

  // 第 2 条起用目录原价叠专属折扣，不能拿新人单价再打折
  const catalogOriginal = input.originalUnitPrice || input.unitPrice
  const rest = currency(catalogOriginal, { precision: 6 }).multiply(qty - 1).multiply(factor).value
  const bandwidth = currency(input.bandwidthAmount, { precision: 6 }).multiply(factor).value
  const amount = currency(input.newUserUnitPrice, { precision: 6 }).add(rest).add(bandwidth).value
  const originalAmount = currency(catalogOriginal, { precision: 6 }).multiply(qty).add(input.bandwidthAmount).value
  return {
    amount,
    originalAmount,
    diffAmount: currency(originalAmount, { precision: 6 }).subtract(amount).value,
  }
}
