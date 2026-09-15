import currency from 'currency.js'
import type { Duration, Plan } from './type'

export function tierCalculate(list: Plan[], count: number) {
  if (!list?.length || !count || count < 1) {
    return { value: 0, algorithm: '' }
  }

  const { sum, algorithm } = list.reduceRight((acc, { windowPrice, minWindows }) => {
    if (count < minWindows) {
      return acc
    }

    const tiersCount = currency(count).subtract(minWindows).value

    if (tiersCount !== 0) {
      acc.algorithm.unshift(`${minWindows === 0 ? count : `(${count} - ${minWindows})`} × $${windowPrice.toFixed(2)}`)
    }

    count = minWindows
    acc.sum = currency(tiersCount, { precision: 6 }).multiply(windowPrice).add(acc.sum).value

    return acc
  }, { sum: 0, algorithm: [] as string[] })

  return { value: sum, algorithm: `${algorithm.join(' + ')} = $${sum.toFixed(2)}` }
}

export function discountCalculate(discounts: number[]) {
  return discounts.reduce((acc, discount) =>
    Math.abs(currency(Number.isNaN(discount) ? 0 : discount, { precision: 6 })
      .divide(100)
      .add(-1)
      .multiply(acc).value), 1)
}

/** 获取小于 30 天的价格倍数 */
export function getMultiplePriceLessThan30(day: number) {
  if (day < 7) {
    return 5
  }
  if (day < 30) {
    return 2
  }
  return 1
}

/**
 * 由月单价换算所选时长原价（只含短周期加价，不含账户/时长折扣）。
 */
export function durationAmountFromMonthly(monthlyPrice: number, day = 30, precision = 6) {
  const amount = currency(monthlyPrice, { precision }).multiply(day).divide(30)
  return amount.multiply(getMultiplePriceLessThan30(day)).value
}

/**
 * 该档计价乘数：短周期加价 × 时长/活动折扣系数。
 * 账户折扣烘进月单价，不在这里相乘；买赠天数不算价。
 */
export function durationTierRate(day: number, discounts: number[] = []) {
  return currency(getMultiplePriceLessThan30(day), { precision: 6 })
    .multiply(discountCalculate(discounts))
    .value
}

/**
 * 已折月价换算该档实付：月价 × day / 30 × rate。
 */
export function durationPayableAmount(discountedMonthly: number, day: number, rate: number) {
  return currency(discountedMonthly, { precision: 6 })
    .multiply(day)
    .divide(30)
    .multiply(rate)
    .value
}

/**
 * 时长卡日单价展示金额：实付摊到「购买天数 + 买赠天数」。
 * 买赠只拉低展示日均，不改结算；摊到分后向上取整，保证 日单价 × 总天数 ≥ 实付；1 天档不取整，避免把参考价抬高。仅展示，不参与结算。
 */
export function formatDurationDailyUnitPrice(
  monthlyPrice: number,
  day: number,
  rate: number,
  giftDays = 0,
) {
  const usageDays = day + (giftDays || 0)
  const cents = currency(monthlyPrice, { precision: 6 })
    .multiply(rate)
    .divide(30)
    .multiply(day)
    .divide(usageDays)
    .multiply(100)
    .value

  const ceiledCents = day === 1 ? cents : Math.ceil(cents)
  return currency(ceiledCents).divide(100).format()
}

/**
 * 按档位生成日单价展示文案；list 未就绪时不返回，避免空卡误显 $0.00。
 * 读取 giftDays，资格异步回写后日均会跟着重算。
 */
export function mapDurationDailyUnitPrices(
  monthlyPrice: number,
  list: Duration[] | undefined,
) {
  if (!list) {
    return
  }

  return Object.fromEntries(
    list.map(item => [
      item.day,
      formatDurationDailyUnitPrice(monthlyPrice, item.day, item.rate, item.giftDays ?? 0),
    ]),
  ) as Record<number, string>
}

/**
 * 将「购买月数」换成展示天数。
 * 7 表示 7 天短周期，不能按 7×30 算成 210 天。
 */
export function purchaseMonthsToDays(months: number) {
  return months === 7 ? 7 : months * 30
}

/** 展示金额（两位小数）有差额时才视为有折扣，避免 7 天折算精度把原价/实付判成不相等 */
export function hasVisiblePriceDiscount(original: number, actual: number) {
  return currency(original).format() !== currency(actual).format()
}

export function formatTierData(list: Plan[]) {
  const MAX_STEP = 100
  return (list || []).reduce((acc, { minWindows, maxWindows }) => {
    const step = Math.min(maxWindows - minWindows, MAX_STEP)
    if (minWindows <= MAX_STEP) {
      acc.steps.set(minWindows, step)
    }
    acc.tiers.push({ start: minWindows, end: maxWindows, step })
    return acc
  }, { tiers: [], steps: new Map() } as { tiers: { start: number, end: number, step: number }[], steps: Map<number, number> })
}

export function ceilByStep(value: number, step: number) {
  return value % step === 0
    ? value
    : currency(Math.floor(currency(value).divide(step).value))
      .multiply(step)
      .add(step)
      .value
}

export function alignSubscribeCount(value: number, tiers: { start: number, end: number }[], step: number) {
  return value < 100
    ? tiers.findLast(t => value > t.start)!.end
    : ceilByStep(value, step)
}

// export function getNextTierCount(current: number, tiers: { start: number, end: number }[], tierSteps: [number, number][]) {
//   if (tiers.length < 2)
//     return current
//   const minPaid = tiers[1]!.start
//   const maxEnd = tiers[tiers.length - 1]!.end
//   if (current >= maxEnd)
//     return maxEnd
//   const probe = Math.max(currency(current).add(1).value, minPaid)
//   const step = tierSteps.findLast(([min]) => probe >= min)?.[1] ?? 10
//   return alignSubscribeCount(probe, tiers, step)
// }
