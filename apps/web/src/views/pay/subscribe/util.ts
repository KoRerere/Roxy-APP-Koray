import currency from 'currency.js'
import type { Plan } from './type'

export function tierCalculate(list: Plan[], count: number) {
  if (!list?.length || !count || count < 1) {
    return { value: 0, algorithm: '' }
  }

  const { sum, algorithm } = list.reduceRight((acc, { windowPrice, minWindows }) => {
    if (count < minWindows)
      return acc

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

export function formatTierData(list: Plan[]) {
  const MAX_STEP = 100
  return (list || []).reduce((acc, { minWindows, maxWindows }) => {
    const step = Math.min(maxWindows - minWindows, MAX_STEP)
    if (minWindows <= MAX_STEP)
      acc.steps.set(minWindows, step)
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
