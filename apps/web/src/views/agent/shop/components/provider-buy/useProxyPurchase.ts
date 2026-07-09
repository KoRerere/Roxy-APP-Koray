import currency from 'currency.js'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'
import { ProxyUseType } from '/@/enums/proxy'
import { discountCalculate } from '/@/views/pay/subscribe/util'
import { formatBandwidthPriceList, formatProxyPriceList, getProxyTypePriceForSelectedDuration } from './utils'
import type { Ref } from 'vue'
import type { BuyEntryType } from '/@/enums/proxy'
import type { BandwidthOption, BusinessUseOption, CountryOption, DurationOption, ProxyTypeOption } from './utils'

export function useProxyPurchaseApi(options: { entryType: BuyEntryType }) {
  const { isZh } = storeToRefs(useSimpleLocale())
  const [_, onlyErrorToast] = useResponseToast()

  async function getBusinessUseList(vendorId: string): Promise<BusinessUseOption[]> {
    const { code, data, msg } = await API.proxy.userGetProxyBusinessSceneListList({ vendorId })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return []

    return data.map(item => ({
      image: item.sceneIcon,
      darkImage: item.sceneIconDark,
      label: item.sceneKey,
      value: item.id,
      desc: item.sceneDesc,
      badgeType: item.badgeType ?? '',
      badgeDesc: item.badgeTypeDesc ?? undefined,
      badgeClass: item.badgeType?.toLocaleLowerCase(),
      isSpecialOffer: item.isSpecialOffer,
    })).filter((item) => {
      if (item.badgeType === 'Direct')
        return isZh.value
      return true
    })
  }

  async function getProxyTypeList(sceneId: number, countryCode: string): Promise<ProxyTypeOption[]> {
    const { code, data, msg } = await API.proxy.userGetProxyProvidersByBusinessSceneCountryList({
      sceneId: sceneId.toString(),
      countryCode,
      entryType: options.entryType.toString(),
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return []

    return data.map(item => ({
      ...item,
      value: item.id,
      label: item.typeName,
      desc: item.hoverText,
      proxyPriceListFmt: formatProxyPriceList(item.proxyPriceList),
      proxyBandwidthPriceListFmt: formatBandwidthPriceList(item.proxyBandwidthPriceList),
    }))
  }

  async function getPurchaseCountryListByScene(sceneId: number): Promise<CountryOption[]> {
    const { code, data, msg } = await API.proxy.userGetProxyCountryListByBusinessSceneList({
      sceneId: sceneId.toString(),
      entryType: options.entryType.toString(),
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return []

    return data.map(item => ({
      ...item,
      icon: `country-code/${item.country_code?.toLocaleUpperCase()}`,
      label: `${item.country_name} / ${item.country_code?.toLocaleUpperCase()}`,
      name: item.country_name,
      value: item.country_code,
    }))
  }

  return { getBusinessUseList, getProxyTypeList, getPurchaseCountryListByScene }
}

export function createProxyPurchaseCountryCache(options: {
  fetchCountryList: (sceneId: number) => Promise<CountryOption[]>
  vendorId: () => string | number | undefined
}) {
  const countriesByScene = new Map<string, CountryOption[]>()

  const joinKey = (parts: (string | number)[]) => parts.join(':')

  function snapshot<T>(v: T): T {
    return structuredClone(v)
  }

  async function getCountryOptions(sceneId: number) {
    const k = joinKey([options.vendorId() ?? '', sceneId])
    const hit = countriesByScene.get(k)
    if (hit)
      return snapshot(hit)
    const data = await options.fetchCountryList(sceneId)
    countriesByScene.set(k, snapshot(data))
    return snapshot(data)
  }

  function hasCountryOptions(sceneId: number) {
    const k = joinKey([options.vendorId() ?? '', sceneId])
    return countriesByScene.has(k)
  }

  async function preloadCountryOptions(sceneIds: number[]) {
    for (const sceneId of sceneIds) {
      const k = joinKey([options.vendorId() ?? '', sceneId])
      if (countriesByScene.has(k))
        continue
      try {
        await getCountryOptions(sceneId)
      }
      catch {
        // 预加载失败不影响主流程
      }
    }
  }

  return { getCountryOptions, hasCountryOptions, preloadCountryOptions }
}

export type ProxyPurchaseCountryCache = ReturnType<typeof createProxyPurchaseCountryCache>

export function useProxyPurchaseForm(options: {
  vendorId: string
  getBusinessUseList: (vendorId: string) => Promise<BusinessUseOption[]>
  getProxyTypeList: (sceneId: number, countryCode: string) => Promise<ProxyTypeOption[]>
  countryCache: ProxyPurchaseCountryCache
}) {
  const loading = ref(false)
  const loadingProxyType = ref(false)
  const loadingPurchaseCountry = ref(false)
  const purchaseMember = ref(1)

  const businessUseOptions = ref<BusinessUseOption[]>([])
  const businessUse = ref<BusinessUseOption>()

  const countryOptions = ref<CountryOption[]>([])
  const purchaseCountry = ref<CountryOption>()
  const countryDisabled = ref(false)

  const durationOptions = ref<DurationOption[]>([])
  const subscriptionMonths = ref<DurationOption>()

  const proxyTypeOptions = ref<ProxyTypeOption[]>([])
  const proxyTypeValue = ref<number | undefined>(undefined)
  const proxySpeedOptions = ref<BandwidthOption[]>([])
  const proxySpeedValue = ref<number | undefined>(undefined)

  function updatePurchaseMemberClamp(inventory: number) {
    purchaseMember.value = Math.min(purchaseMember.value, Math.max(inventory, 1))
  }

  function syncSubscriptionMonthsFromProxyType(proxyType?: ProxyTypeOption) {
    const opts = proxyType?.proxyPriceListFmt ?? []
    durationOptions.value = opts
    subscriptionMonths.value = opts[0]
  }

  function syncQuantityFromProxyType(proxyType?: ProxyTypeOption) {
    updatePurchaseMemberClamp(proxyType?.inventory ?? 0)
  }

  function syncProxySpeedFromProxyType(proxyType?: ProxyTypeOption) {
    proxySpeedOptions.value = proxyType?.proxyBandwidthPriceListFmt ?? []
    proxySpeedValue.value = proxySpeedOptions.value[0]?.value
  }

  function applyProxyTypeRadios(typeOptions: ProxyTypeOption[]) {
    proxyTypeOptions.value = typeOptions ?? []
    const first = proxyTypeOptions.value[0]
    proxyTypeValue.value = first?.id
    syncSubscriptionMonthsFromProxyType(first)
    syncQuantityFromProxyType(first)
    syncProxySpeedFromProxyType(first)
  }

  function applyPurchaseCountryList(list: CountryOption[]) {
    countryOptions.value = list
    purchaseCountry.value = list[0]
    countryDisabled.value = list.length === 1
  }

  async function refreshFromScene(sceneId: number) {
    const countryCached = options.countryCache.hasCountryOptions(sceneId)
    if (!countryCached)
      loadingPurchaseCountry.value = true

    loadingProxyType.value = true
    try {
      const list = await options.countryCache.getCountryOptions(sceneId)
      applyPurchaseCountryList(list)
      loadingPurchaseCountry.value = false

      const firstCode = list[0]?.value ?? ''
      const typeOptions = firstCode
        ? await options.getProxyTypeList(sceneId, firstCode)
        : []
      applyProxyTypeRadios(typeOptions)
    }
    finally {
      loadingProxyType.value = false
      loadingPurchaseCountry.value = false
    }
  }

  async function refreshProxyTypesForCountry(countryCode: string) {
    const sceneId = businessUse.value?.value
    if (sceneId == null)
      return

    loadingProxyType.value = true
    try {
      const typeOptions = await options.getProxyTypeList(sceneId, countryCode)
      applyProxyTypeRadios(typeOptions)
    }
    finally {
      loadingProxyType.value = false
    }
  }

  async function selectBusinessUse(option: BusinessUseOption) {
    businessUse.value = option
    await refreshFromScene(option.value)
  }

  async function selectCountry(option: CountryOption) {
    purchaseCountry.value = option
    await refreshProxyTypesForCountry(option.value)
  }

  async function init() {
    loading.value = true
    const businessOptions = await options.getBusinessUseList(options.vendorId)
    businessUseOptions.value = businessOptions

    const firstScene = businessOptions[0]
    if (!firstScene) {
      loading.value = false
      return
    }

    businessUse.value = firstScene
    const list = await options.countryCache.getCountryOptions(firstScene.value)
    applyPurchaseCountryList(list)

    void options.countryCache.preloadCountryOptions(
      businessOptions.slice(1).map(option => option.value),
    )

    const firstCountryCode = list[0]?.value ?? ''
    const typeOptions = firstCountryCode
      ? await options.getProxyTypeList(firstScene.value, firstCountryCode)
      : []
    applyProxyTypeRadios(typeOptions)
    loading.value = false
  }

  watch(proxyTypeValue, (id) => {
    if (id == null)
      return
    const row = proxyTypeOptions.value.find(item => item.id === id)
    if (!row)
      return
    syncSubscriptionMonthsFromProxyType(row)
    syncQuantityFromProxyType(row)
    syncProxySpeedFromProxyType(row)
  })

  return {
    loading,
    loadingProxyType,
    loadingPurchaseCountry,
    purchaseMember,
    businessUseOptions,
    businessUse,
    countryOptions,
    purchaseCountry,
    countryDisabled,
    durationOptions,
    subscriptionMonths,
    proxyTypeOptions,
    proxyTypeValue,
    proxySpeedOptions,
    proxySpeedValue,
    init,
    selectBusinessUse,
    selectCountry,
    refreshFromScene,
  }
}

export function useProxyPurchasePricing(options: {
  userPayInfo: Ref<{ proxyDiscount?: number } | undefined>
  businessUse: Ref<BusinessUseOption | undefined>
  purchaseCountry: Ref<CountryOption | undefined>
  subscriptionMonths: Ref<DurationOption | undefined>
  proxyTypeOptions: Ref<ProxyTypeOption[]>
  proxyTypeValue: Ref<number | undefined>
  proxySpeedOptions: Ref<BandwidthOption[]>
  proxySpeedValue: Ref<number | undefined>
  purchaseMember: Ref<number>
  networkCountryCode: Ref<string | undefined>
}) {
  const isDirect = computed(() => options.businessUse.value?.badgeType === ProxyUseType.Direct)

  const isCN = computed(() => {
    return options.networkCountryCode.value === 'CN' && !isDirect.value
  })

  const currentProxyType = computed(() => {
    const row = options.proxyTypeOptions.value.find(item => item.id === options.proxyTypeValue.value)
    return {
      ...row,
      inventory: row?.inventory ?? 0,
    }
  })

  const selectedUnit = computed(() => {
    const proxyType = options.proxyTypeOptions.value.find(item => item.id === options.proxyTypeValue.value)
    if (!proxyType)
      return undefined
    return getProxyTypePriceForSelectedDuration(proxyType, options.subscriptionMonths.value?.value)
  })

  const selectedBandwidthPrice = computed(() => {
    const proxySpeed = options.proxySpeedOptions.value.find(item => item.value === options.proxySpeedValue.value)
    if (!proxySpeed)
      return 0
    const proxyPurchaseMonths = selectedUnit.value?.proxyPurchaseMonths ?? 1
    return proxySpeed.bandwidthPriceMonths[proxyPurchaseMonths] ?? 0
  })

  const originalAmount = computed(() => {
    const selectedUnitPrice = selectedUnit.value?.proxyPrice ?? 0
    return currency(selectedUnitPrice, { precision: 6 }).multiply(options.purchaseMember.value).value
  })

  const finalResult = computed(() => {
    const { proxyDiscount = 0 } = options.userPayInfo.value ?? {}
    const businessUse = options.businessUse.value
    const proxyAmount = businessUse?.isSpecialOffer
      ? originalAmount.value
      : currency(originalAmount.value, { precision: 6 }).multiply(discountCalculate([proxyDiscount])).value
    const speedAmount = businessUse?.isSpecialOffer
      ? selectedBandwidthPrice.value
      : currency(selectedBandwidthPrice.value, { precision: 6 }).multiply(discountCalculate([proxyDiscount])).value
    const diffAmount = currency(originalAmount.value, { precision: 6 }).add(selectedBandwidthPrice.value).subtract(proxyAmount).subtract(speedAmount).value

    return {
      amount: currency(proxyAmount, { precision: 6 }).add(speedAmount).value,
      diffAmount,
    }
  })

  const details = computed(() => {
    const purchaseCountry = options.purchaseCountry.value
    const subscriptionMonths = options.subscriptionMonths.value
    const businessUse = options.businessUse.value
    const { proxyDiscount = 0 } = options.userPayInfo.value ?? {}
    const currentProxyType = options.proxyTypeOptions.value.find(item => item.id === options.proxyTypeValue.value)

    return [
      {
        title: 'title',
        items: [
          { label: $t('代理 IP 类型'), slot: 'type' },
          {
            label: $t('代理 IP 带宽'),
            visible: options.proxySpeedOptions.value?.length > 1 || (isDirect.value && currentProxyType?.showDefaultSupport100M),
            slot: 'speed',
          },
        ].filter(item => item.visible !== false),
      },
      {
        items: [
          { label: $t('代理 IP 数量'), value: options.purchaseMember.value },
          { label: $t('国家/地区'), value: purchaseCountry?.label },
          { label: $t('订阅天数'), value: subscriptionMonths?.label },
        ],
      },
      {
        items: [
          {
            label: $t('专属折扣'),
            value: `-${proxyDiscount}%`,
            class: '!color-[#FC9D12]',
            visible: !!proxyDiscount && !businessUse?.isSpecialOffer,
          },
          {
            label: $t('Roxy 独家特惠'),
            value: currency(finalResult.value.amount).format(),
            diffValue: currency(finalResult.value.diffAmount).value,
            slot: 'price',
          },
        ].filter(item => item.visible !== false),
      },
    ]
  })

  return {
    isDirect,
    isCN,
    currentProxyType,
    selectedUnit,
    finalResult,
    details,
  }
}
