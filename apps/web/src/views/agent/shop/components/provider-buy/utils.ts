import { computed, inject, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'
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

/** 购买选项每行固定列数（用途 / 国家 / 带宽 / 时长共用，保证列对齐） */
export const OPTION_GRID_COLUMNS = 5

/** 选项列最大宽度，对应 UnoCSS `w-38` */
const OPTION_COLUMN_MAX = '9.5rem'
/** 选项左右间距 8px，对应 UnoCSS `gap-x-2` */
const OPTION_GAP_MAX = '0.5rem'

/**
 * 购买选项网格样式。
 * 列宽最大 w-38，左右间距固定 0.5rem（8px）；宽度不够时等比收缩列宽，避免折行。
 */
export function getOptionGridStyle(count: number) {
  const columns = Math.max(count, 1)
  return {
    gridTemplateColumns: `repeat(${columns}, minmax(0, ${OPTION_COLUMN_MAX}))`,
    columnGap: OPTION_GAP_MAX,
  }
}

/** 半屏（窄容器）布局开关，由 provider-buy/index.vue 按容器宽度提供 */
export const PROXY_PURCHASE_COMPACT_KEY: InjectionKey<Ref<boolean>> = Symbol('proxy-purchase-compact')
/** 外部强制左右布局，如「购买 + 添加代理」双抽屉并排时，宽度足够就保持左右布局（设计稿 32217:97259） */
export const PROXY_PURCHASE_FORCE_WIDE_KEY: InjectionKey<Ref<boolean>> = Symbol('proxy-purchase-force-wide')
/** 标题与选项上下排列（标题在上、选项铺满整行），由 provider-buy/index.vue 在左右布局的窄列下提供 */
export const PROXY_PURCHASE_STACKED_KEY: InjectionKey<Ref<boolean>> = Symbol('proxy-purchase-stacked')
/** 每行选项列数，由 provider-buy/index.vue 按容器宽度提供（半屏再缩小时变成 4 列） */
export const PROXY_PURCHASE_COLUMNS_KEY: InjectionKey<Ref<number>> = Symbol('proxy-purchase-columns')

/**
 * 购买选项网格样式（自动区分全屏 / 半屏）。
 * 默认每行 5 列、左右间距 0.5rem；全屏列宽最大 w-38，半屏等分铺满，半屏再缩小时每行 4 列。
 */
export function useOptionGridStyle(minColumns = 1) {
  const compact = inject(PROXY_PURCHASE_COMPACT_KEY, ref(false))
  const stacked = inject(PROXY_PURCHASE_STACKED_KEY, ref(false))
  const injectedColumns = inject(PROXY_PURCHASE_COLUMNS_KEY, ref(OPTION_GRID_COLUMNS))
  /** 带宽 / 时长固定 4 个选项，传 minColumns=4 保证始终一行放下 */
  const columns = computed(() => Math.max(injectedColumns.value, minColumns))
  const style = computed(() => compact.value
    ? { gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))`, columnGap: OPTION_GAP_MAX }
    : getOptionGridStyle(columns.value))
  return { compact, stacked, style }
}
