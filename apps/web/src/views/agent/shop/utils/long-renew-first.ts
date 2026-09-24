import currency from 'currency.js'
import { percentOffToZhe } from '/@/utils/basic'
import { discountCalculate } from '/@/views/pay/subscribe/util'

export { formatDiscountOff, percentOffToZhe } from '/@/utils/basic'

/** 90 天及以上才算长续；30 天与自动续费不参与长续首享 */
const LONG_RENEW_MIN_DAYS = 90

/** 列表行上的长续首享资格字段 */
export interface LongRenewFirstFlags {
  /** true 表示该 IP 具备长续首享资格 */
  longRenewFirstEligible?: boolean
  /** true 表示资格已使用或待支付占用 */
  longRenewFirstUsed?: boolean
}

/**
 * 有资格且尚未使用才可享。
 * 必须同时看两个字段：`longRenewFirstEligible === true` 且 `longRenewFirstUsed === false`。
 * 缺任一或无资格/已使用都不加长续优惠，避免把未使用但无资格的 IP 当成可享。
 */
export function canUseLongRenewFirst(item: LongRenewFirstFlags) {
  return item.longRenewFirstEligible === true && item.longRenewFirstUsed === false
}

/** 本次续费列表是否至少有一个可享长续首享的 IP */
export function hasLongRenewFirstOffer(items: LongRenewFirstFlags[]) {
  return items.some(canUseLongRenewFirst)
}

/** 右键「n折特惠」：账户最低长续档 % Off 转展示文案；无折扣返回空 */
export function getLongRenewDealLabel(percentOff?: number) {
  const off = Number(percentOff ?? 0) || 0
  if (off <= 0) {
    return ''
  }
  return $t('{discount}折特惠', {
    discount: percentOffToZhe(off),
    off,
  })
}

/**
 * 当前周期对该 IP 的长续首享 % Off。
 * 无资格或短周期返回 0，不消耗、不展示为已用。
 */
export function getLongRenewOffPercent(
  item: LongRenewFirstFlags,
  day: number,
  discountsByDays?: Record<string, number>,
) {
  if (!canUseLongRenewFirst(item) || day < LONG_RENEW_MIN_DAYS) {
    return 0
  }
  return Number(discountsByDays?.[String(day)] ?? 0) || 0
}

/**
 * 续费时该 IP 可用的身份折扣。
 * 大陆直连不享受身份优惠，只允许长续首享。
 */
export function getRenewIdentityOff(item: { isDirect?: boolean }, identityOff: number) {
  if (item.isDirect) {
    return 0
  }
  return identityOff || 0
}

/**
 * 当前时长下该 IP 实际采用的 % Off：长续首享与身份折扣取更大一档。
 * 直连 IP 身份折扣为 0，因此只会落到长续或原价。
 */
export function getAppliedOffPercent(
  item: LongRenewFirstFlags & { isDirect?: boolean },
  day: number,
  identityOff: number,
  discountsByDays?: Record<string, number>,
) {
  return Math.max(
    getLongRenewOffPercent(item, day, discountsByDays),
    getRenewIdentityOff(item, identityOff),
  )
}

/** 本次续费各 IP 实际用到的最大一档 % Off，底部「已享最优折扣」按此展示，不用加权总价比 */
export function getMaxAppliedOffPercent(
  items: Array<LongRenewFirstFlags & { isDirect?: boolean }>,
  day: number,
  identityOff: number,
  discountsByDays?: Record<string, number>,
) {
  return items.reduce((max, item) => {
    return Math.max(max, getAppliedOffPercent(item, day, identityOff, discountsByDays))
  }, 0)
}

/**
 * 月单价：原价 `proxyProviderPrice` 乘当前最优折扣。
 * 表格单价列随所选时长变化，不用服务商特惠价。
 */
export function calcProxyRenewUnitPrice(input: {
  proxyProviderPrice: number
  day: number
  identityOff: number
  discountsByDays?: Record<string, number>
  /** 大陆直连不享受身份折扣 */
  isDirect?: boolean
} & LongRenewFirstFlags) {
  const appliedOff = getAppliedOffPercent(
    input,
    input.day,
    input.identityOff,
    input.discountsByDays,
  )
  if (appliedOff <= 0) {
    return input.proxyProviderPrice
  }
  return currency(input.proxyProviderPrice, { precision: 6 }).multiply(discountCalculate([appliedOff])).value
}

/**
 * 长续首享与身份折扣不叠乘：作用在原价 `proxyProviderPrice` 上，取 % Off 更大的一档。
 * 大陆直连身份折扣为 0；不用 `proxyProviderDiscountPrice`，避免服务商特惠再与长续/身份叠乘。
 */
export function calcProxyRenewItemAmount(input: {
  proxyProviderPrice: number
  months: number
  day: number
  identityOff: number
  discountsByDays?: Record<string, number>
  /** 大陆直连不享受身份折扣 */
  isDirect?: boolean
} & LongRenewFirstFlags) {
  const unit = calcProxyRenewUnitPrice(input)
  return currency(input.months, { precision: 6 }).multiply(unit).value
}

/** 批量续费：有资格 IP 按互斥折扣、无资格非直连只打身份折，直连无长续则原价 */
export function calcProxyRenewTotalAmount(
  items: Array<{ proxyProviderPrice?: number, isDirect?: boolean } & LongRenewFirstFlags>,
  months: number,
  day: number,
  identityOff: number,
  discountsByDays?: Record<string, number>,
) {
  return items.reduce((acc, item) => {
    return currency(acc).add(calcProxyRenewItemAmount({
      proxyProviderPrice: item.proxyProviderPrice ?? 0,
      months,
      day,
      longRenewFirstEligible: item.longRenewFirstEligible,
      longRenewFirstUsed: item.longRenewFirstUsed,
      isDirect: item.isDirect,
      identityOff,
      discountsByDays,
    })).value
  }, 0)
}

/**
 * 当前时长下列表实际用到的优惠来源。
 * 混合：部分 IP 本档走长续（有资格且未使用），其余因无资格、已使用、直连无身份折或身份折扣更优未走长续。
 * 不可享不能只看 `longRenewFirstUsed`，`longRenewFirstEligible === false` 同样不算长续。
 */
export function getProxyRenewOffMix(
  items: Array<LongRenewFirstFlags & { isDirect?: boolean }>,
  day: number,
  identityOff: number,
  discountsByDays?: Record<string, number>,
) {
  let longRenewCount = 0
  let otherCount = 0
  let longRenewOff = 0
  for (const item of items) {
    const longOff = getLongRenewOffPercent(item, day, discountsByDays)
    const idOff = getRenewIdentityOff(item, identityOff)
    // 长续与身份取更大一档；相等时算长续，与计价 max 口径一致
    if (longOff > 0 && longOff >= idOff) {
      longRenewCount++
      longRenewOff = longOff
    }
    else {
      otherCount++
    }
  }
  return {
    mixed: longRenewCount > 0 && otherCount > 0,
    longRenewCount,
    longRenewOff,
  }
}

/** 未打折前的原价合计，底部划线原价与「共计优惠」都相对它计算 */
export function calcProxyRenewOriginalAmount(
  items: Array<{ proxyProviderPrice?: number }>,
  months: number,
) {
  return items.reduce((acc, item) => {
    return currency(acc).add(currency(months, { precision: 6 }).multiply(item.proxyProviderPrice ?? 0)).value
  }, 0)
}

