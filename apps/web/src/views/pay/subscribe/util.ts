import currency from 'currency.js'

interface Tier {
  windowPrice: number
  minWindows: number
  [key: string]: any
}

export function tierCalculate(list: Tier[], count: number) {
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

export function ceilByStep(value: number, step: number) {
  return value % step === 0
    ? value
    : currency(Math.floor(currency(value).divide(step).value))
      .multiply(step)
      .add(step)
      .value
}
