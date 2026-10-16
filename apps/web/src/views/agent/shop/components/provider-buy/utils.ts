import { purchaseMonthsToDays } from '/@/views/pay/subscribe/util'

export interface BusinessUseOption {
  image?: string
  darkImage?: string
  label: string
  value: number
  desc?: string
  badgeType: string
  badgeDesc?: string
  scenePriceDesc?: string
  badgeClass?: string
  isSpecialOffer?: boolean
}

export interface CountryOption {
  country_code: string
  country_name: string
  continent_name?: string
  icon: string
  label: string
  name: string
  value: string
  status?: string
  isNew?: boolean
  isHot?: boolean
  /** 该国主推代理类型（后端字段名拼写如此） */
  proxyTpye?: string
  /** 该国可售代理类型，判断新人 IP 福利样式时必须命中其中一项 */
  proxyTpyeList?: string[]
}

export interface DurationOption {
  label: string
  value: number
  day: number
  proxyPrice: number
  originalProxyPrice: number
  proxyPurchaseMonths: number
}

export interface BandwidthOption {
  label: string
  value: number
  bandwidthSpeed: number
  bandwidthSpeedDesc?: string
  bandwidthPriceMonths: Record<number, number>
}

export interface ProxyTypeOption {
  id: number
  value: number
  label: string
  typeName: string
  desc?: string
  proxyType?: string
  inventory?: number
  proxyPriceListFmt: DurationOption[]
  proxyBandwidthPriceListFmt: BandwidthOption[]
  showDefaultSupport100M?: boolean
}

export function formatProxyPriceList(proxyPriceList: Array<Record<string, any>> = []): DurationOption[] {
  return proxyPriceList.map((row) => {
    const day = purchaseMonthsToDays(row.proxyPurchaseMonths)
    return {
      label: $t('{day} 天', { day }),
      value: row.proxyPurchaseMonths,
      day,
      proxyPrice: row.proxyPrice,
      originalProxyPrice: row.originalProxyPrice,
      proxyPurchaseMonths: row.proxyPurchaseMonths,
      ...row,
    }
  })
}

export function formatBandwidthPriceList(proxyBandwidthPriceList: Array<Record<string, any>> = []): BandwidthOption[] {
  return proxyBandwidthPriceList.map(row => ({
    label: `${row.bandwidthSpeed}Mbps`,
    value: row.bandwidthSpeed,
    bandwidthSpeed: row.bandwidthSpeed,
    bandwidthSpeedDesc: row.bandwidthSpeedDesc,
    bandwidthPriceMonths: row.bandwidthPriceMonths ?? {},
    ...row,
  }))
}

export function groupCountryOptionsByContinent(options: CountryOption[]): { title: string, items: CountryOption[] }[] {
  const byContinent = new Map<string, CountryOption[]>()
  for (const opt of options) {
    const title = opt.continent_name ?? ''
    let bucket = byContinent.get(title)
    if (!bucket) {
      bucket = []
      byContinent.set(title, bucket)
    }
    bucket.push(opt)
  }
  return Array.from(byContinent.entries(), ([title, items]) => ({ title, items }))
}

export function getProxyTypePriceForSelectedDuration(
  proxyType: { proxyPriceListFmt?: DurationOption[] },
  durationValue?: number,
) {
  if (durationValue == null) {
    return undefined
  }
  return proxyType.proxyPriceListFmt?.find(row => row.value === durationValue)
}

/** 选项列最大宽度，对应 UnoCSS `w-38` */
const OPTION_COLUMN_MAX = '9.5rem'
/** 选项间距上限，对应 UnoCSS `gap-3` */
const OPTION_GAP_MAX = '0.75rem'
/** 选项间距下限，对应 UnoCSS `gap-1.5` */
const OPTION_GAP_MIN = '0.375rem'

/**
 * 购买选项网格样式。
 * 列宽最大 w-38，间距在 gap-1.5 到 gap-3 之间；宽度不够时先缩小间距，间距到下限后再等比收缩列宽，避免折行。
 */
export function getOptionGridStyle(count: number) {
  const columns = Math.max(count, 1)
  const gapCount = Math.max(columns - 1, 1)
  return {
    gridTemplateColumns: `repeat(${columns}, minmax(0, ${OPTION_COLUMN_MAX}))`,
    columnGap: `max(${OPTION_GAP_MIN}, min(${OPTION_GAP_MAX}, (100% - ${columns} * ${OPTION_COLUMN_MAX}) / ${gapCount}))`,
  }
}
