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
    const day = row.proxyPurchaseMonths * 30
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
  if (durationValue == null)
    return undefined
  return proxyType.proxyPriceListFmt?.find(row => row.value === durationValue)
}
