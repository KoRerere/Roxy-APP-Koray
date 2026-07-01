<script setup lang="tsx">
import RxLoading from '/@/components/rx-loading.vue'
import RxTooltip from '/@/components/rx-tooltip'
import RxButton from '/@/components/rx-button'
import RxImage from '/@/components/rx-image'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import SellOutModal from '/@/views/agent/shop/components/sell-out-modal.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import RxStepInput from '/@/components/rx-step-input/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon'
import { I18nT } from 'vue-i18n'
import currency from 'currency.js'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import Fuse from 'fuse.js'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
import { useNetworkStore } from '/@/stores/network'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { PayWay } from '/@/enums/pay'
import { BuyEntryType, ProxyIpType, ProxyOrderType, ProxyStockStatus, ProxyUseType } from '/@/enums/proxy'
import { usePay } from '/@/views/pay/wallet/hook'
import { discountCalculate } from '/@/views/pay/subscribe/util'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import RadioButton from 'primevue/radiobutton'

const { data: provider = {}, entryType = BuyEntryType.Normal, toRola } = defineProps<{
  entryType?: BuyEntryType
  data?: Record<string, any>
  toRola: () => void
}>()

const emit = defineEmits(['close', 'success'])

const styles = useCssModule()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()
const { getOfficialWebsite } = useSimpleLocale()
const { isZh } = storeToRefs(useSimpleLocale())
const { info: networkInfo } = storeToRefs(useNetworkStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { check } = usePermission()
const { showFreedomActivityModal } = useFreedomActivity()

const ONE_BUY_MAX = 1000
const configs = ref<any[]>([])
const loading = ref(false)
const loadingProxyType = ref(false)
const loadingPurchaseCountry = ref(false)
const purchaseMember = ref(1)
const searchCountry = ref('')

/** 右侧明细区代理类型单选列表（数据源与左侧国家→类型联动一致） */
const CID = `${getCurrentInstance()?.uid ?? ''}-ptype`
const proxyTypeOptions = ref<any[]>([])
const proxyTypeValue = ref<number | undefined>(undefined)
const proxySpeedOptions = ref<any[]>([])
const proxySpeedValue = ref<number | undefined>(undefined)

const notes = [
  {
    text: $t('所有代理 IP 都 {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('同时支持 SOCKS5 和 HTTP 协议')],
  },
  {
    text: $t('您购买的所有代理 IP 都是 {bold0}，不会与他人共享。', { bold0: '{bold0}' }),
    bolds: [$t('独享专用 IP')],
  },
  {
    text: $t('订阅期间所有代理 IP {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('不限流量')],
  },
  {
    text: $t('若购买的代理 IP 出现 {bold0} 的问题，支持 {bold1}。', { bold0: '{bold0}', bold1: '{bold1}' }),
    bolds: [$t('无法连接'), $t('免费更换或退款')],
  },
  {
    text: $t('您可以在代理 IP 列表中延长代理 IP 的使用期限，{bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('价格与购买时相同')],
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('代理 IP 过期后将被停用，无法找回或再次续费。')],
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('所有代理 IP 均由 Roxy浏览器从 {name} 特挑。', { name: provider.vendorName })],
  },
].slice(0, provider.vendorName === 'RoxyIP' ? 6 : 7)

const configValue = computed(() => {
  const config = Object.fromEntries(configs.value.map(item => [item.name, item.value]))
  return {
    purchaseCountry: {},
    businessUse: {},
    subscriptionMonths: {},
    proxyProviderId: { value: proxyTypeValue.value },
    bandwidthSpeed: { value: proxySpeedValue.value },
    ...config,
  }
})

const isDirect = computed(() => {
  const { businessUse } = configValue.value
  return businessUse.badgeType === ProxyUseType.Direct
})

const isCN = computed(() => {
  return networkInfo.value?.country_code === 'CN' && !isDirect.value
})

const currentProxyType = computed(() => {
  const row = proxyTypeOptions.value.find(item => item.id === proxyTypeValue.value)
  return {
    ...row,
    inventory: row?.inventory ?? 0,
  }
})

const selectedUnitPrice = computed(() => {
  const proxyType = proxyTypeOptions.value.find(item => item.id === proxyTypeValue.value)
  if (!proxyType)
    return 0
  return getProxyTypePriceForSelectedDuration(proxyType)?.proxyPrice ?? 0
})

const selectedBandwidthPrice = computed(() => {
  const proxySpeed = proxySpeedOptions.value.find(item => item.value === proxySpeedValue.value)
  if (!proxySpeed)
    return 0
  return proxySpeed.bandwidthPrice
})

const originalAmount = computed(() => {
  return currency(selectedUnitPrice.value * purchaseMember.value).value
})

const finalResult = computed(() => {
  const { proxyDiscount } = userPayInfo.value!
  const { businessUse } = configValue.value

  const proxyAmount = businessUse.isSpecialOffer ? originalAmount.value : currency(originalAmount.value).multiply(discountCalculate([proxyDiscount])).value
  const speedAmount = businessUse.isSpecialOffer ? selectedBandwidthPrice.value : currency(selectedBandwidthPrice.value).multiply(discountCalculate([proxyDiscount])).value
  const diffAmount = currency(originalAmount.value).add(selectedBandwidthPrice.value).subtract(proxyAmount).subtract(speedAmount).value

  return {
    amount: currency(proxyAmount).add(speedAmount).value,
    diffAmount,
  }
})

const details = computed(() => {
  const { purchaseCountry, subscriptionMonths, businessUse } = configValue.value
  const { proxyDiscount } = userPayInfo.value!

  return [
    {
      title: 'title',
      items: [
        {
          label: $t('代理 IP 类型'),
          slot: 'type',
        },
        {
          label: $t('代理 IP 带宽'),
          visible: proxySpeedOptions.value?.length > 1 || isDirect.value,
          slot: 'speed',
        },
      ].filter(item => item.visible !== false),
    },
    {
      items: [
        {
          label: $t('代理 IP 数量'),
          value: purchaseMember.value,
        },
        {
          label: $t('国家/地区'),
          value: purchaseCountry.label,
        },
        {
          label: $t('订阅天数'),
          value: subscriptionMonths.label,
        },
      ],
    },
    {
      items: [
        {
          label: $t('专属折扣'),
          value: `-${proxyDiscount}%`,
          class: '!color-[#FC9D12]',
          visible: !!proxyDiscount && !businessUse.isSpecialOffer,
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

onMounted(async () => {
  configs.value = await initConfig()
})

async function getBusinessUseList(vendorId: string) {
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
    badgeType: item.badgeType,
    badgeDesc: item.badgeTypeDesc,
    badgeClass: item.badgeType?.toLocaleLowerCase(),
    isSpecialOffer: item.isSpecialOffer,
  })).filter((item) => {
    // 只要中文环境下，才显示 Direct 类型的代理 IP 用途
    if (item.badgeType === 'Direct') {
      return isZh.value
    }

    return true
  })
}

async function getProxyTypeList(sceneId: number, countryCode: string) {
  const { code, data, msg } = await API.proxy.userGetProxyProvidersByBusinessSceneCountryList({ sceneId: sceneId.toString(), countryCode, entryType: entryType.toString() })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return []
  return data.map(item => ({
    ...item,
    value: item.id,
    label: item.typeName,
    desc: item.hoverText,
    proxyPriceListFmt: (item.proxyPriceList ?? []).map((row) => {
      const day = row.proxyPurchaseMonths * 30
      return { label: $t('{day} 天', { day }), value: row.proxyPurchaseMonths, day, ...row }
    }),
    proxyBandwidthPriceListFmt: (item.proxyBandwidthPriceList ?? []).map((row) => {
      return {
        label: `${row.bandwidthSpeed}Mbps`,
        value: row.bandwidthSpeed,
        ...row,
      }
    }),
  }))
}

async function getPurchaseCountryListByScene(sceneId: number) {
  const { code, data, msg } = await API.proxy.userGetProxyCountryListByBusinessSceneList({ sceneId: sceneId.toString(), entryType: entryType.toString() })
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

interface ProxyPurchaseCascade {
  typeOptions: any[]
  countryOptions: any[]
}

function createProxyPurchaseDataCache(options: {
  fetchCountryList: (sceneId: number) => Promise<any[]>
  getProxyTypeList: (sceneId: number, countryCode: string) => Promise<any[]>
  vendorId: () => string | number | undefined
}) {
  const cascadeByScene = new Map<string, ProxyPurchaseCascade>()
  const countriesByScene = new Map<string, any[]>()
  const typesBySceneCountry = new Map<string, any[]>()

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

  async function getTypeOptions(sceneId: number, countryCode: string) {
    const k = joinKey([options.vendorId() ?? '', sceneId, countryCode])
    const hit = typesBySceneCountry.get(k)
    if (hit)
      return snapshot(hit)
    const data = await options.getProxyTypeList(sceneId, countryCode)
    typesBySceneCountry.set(k, snapshot(data))
    return snapshot(data)
  }

  async function getCascade(sceneId: number) {
    const k = joinKey([options.vendorId() ?? '', sceneId])
    const hit = cascadeByScene.get(k)
    if (hit)
      return snapshot(hit)
    const countryOptions = await getCountryOptions(sceneId)
    const firstCode = countryOptions[0]?.value ?? ''
    const typeOptions = firstCode
      ? await getTypeOptions(sceneId, firstCode)
      : []
    const row: ProxyPurchaseCascade = { countryOptions, typeOptions }
    cascadeByScene.set(k, snapshot(row))
    return snapshot(row)
  }

  return { getCascade, getCountryOptions, getTypeOptions }
}

const proxyPurchaseDataCache = createProxyPurchaseDataCache({
  fetchCountryList: getPurchaseCountryListByScene,
  getProxyTypeList,
  vendorId: () => provider.id,
})

function findCfg(name: string) {
  return configs.value.find(c => c.name === name)
}

/** 按当前选中的 IP 时长，取该代理类型对应的单价 */
function getProxyTypePriceForSelectedDuration(proxyType: any) {
  const { subscriptionMonths } = configValue.value
  const durationValue = subscriptionMonths?.value
  if (durationValue == null)
    return undefined
  const priceRow = proxyType.proxyPriceListFmt?.find((row: any) => row.value === durationValue)

  return priceRow
}

/** 按当前选中的 IP 时长，取该代理类型对应的单价文案 */
function formatProxyTypeUnitPrice(proxyType: any) {
  const price = getProxyTypePriceForSelectedDuration(proxyType)
  if (!price)
    return undefined

  return (
    <div class="flex gap-2 shrink-0 whitespace-nowrap">
      <span class="tt-secondary text-4 font-[DingTalk_JinBuTi] leading-5">{ $t('{month}/个', { month: currency(price.proxyPrice).format() }) }</span>
      {price.proxyPrice < price.originalProxyPrice && <span class="tt-inactive text-3 leading-5 line-through">{$t('{month}/个', { month: currency(price.originalProxyPrice).format() }) }</span>}
    </div>
  )
}

function updatePurchaseMemberClamp(inventory: number) {
  purchaseMember.value = Math.min(purchaseMember.value, Math.max(inventory, 1))
}

function updateSubscriptionMonthsFromOptions(options: any[]) {
  const subscriptionMonths = configs.value.find(item => item.name === 'subscriptionMonths')
  if (!subscriptionMonths)
    return
  subscriptionMonths.value = options[0]
  subscriptionMonths.props.options = options
}

function syncQuantityFromProxyType(proxyType: any) {
  updatePurchaseMemberClamp(proxyType?.inventory ?? 0)
}

function syncSubscriptionMonthsFromProxyType(proxyType: any) {
  updateSubscriptionMonthsFromOptions(proxyType?.proxyPriceListFmt ?? [])
}

/** 按当前选中的代理类型，写入右侧明细区带宽选项（数据已在 getProxyTypeList 中格式化） */
function syncProxySpeedFromProxyType(proxyType: any) {
  proxySpeedOptions.value = proxyType?.proxyBandwidthPriceListFmt ?? []
  proxySpeedValue.value = proxySpeedOptions.value[0]?.value
}

/** 与国内「用途→国家→类型」联动一致：写入右侧明细区 Radio 列表（数据已在 getProxyTypeList 中格式化） */
function applyProxyTypeRadios(typeOptions: any[]) {
  proxyTypeOptions.value = typeOptions ?? []
  const first = proxyTypeOptions.value[0]
  proxyTypeValue.value = first?.id
  syncSubscriptionMonthsFromProxyType(first)
  syncQuantityFromProxyType(first)
  syncProxySpeedFromProxyType(first)
}

function applyPurchaseCountryList(countryOptions: any[]) {
  const cfg = findCfg('purchaseCountry')
  if (cfg) {
    cfg.value = countryOptions[0]
    cfg.props.options = countryOptions
    cfg.props.disabled = countryOptions.length === 1
  }
}

async function refreshFromScene(sceneId: number) {
  loadingProxyType.value = true
  loadingPurchaseCountry.value = true
  try {
    const { countryOptions, typeOptions } = await proxyPurchaseDataCache.getCascade(sceneId)
    applyPurchaseCountryList(countryOptions)
    applyProxyTypeRadios(typeOptions)
  }
  finally {
    loadingProxyType.value = false
    loadingPurchaseCountry.value = false
  }
}

async function refreshProxyTypesForCountry(countryCode: string) {
  loadingProxyType.value = true
  try {
    const sceneId = findCfg('businessUse')?.value?.value
    if (sceneId == null)
      return
    const typeOptions = await proxyPurchaseDataCache.getTypeOptions(sceneId, countryCode)
    applyProxyTypeRadios(typeOptions)
  }
  finally {
    loadingProxyType.value = false
  }
}

function groupCountryOptionsByContinent(options: any[]): { title: string, items: any[] }[] {
  const byContinent = new Map<string, any[]>()
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

async function initConfig() {
  loading.value = true

  const _businessOptions = await getBusinessUseList(provider.id)
  const { countryOptions: _countryOptions, typeOptions: _typeOptions } = await proxyPurchaseDataCache.getCascade(_businessOptions[0].value)

  loading.value = false

  applyProxyTypeRadios(_typeOptions ?? [])

  const _durationOptions = proxyTypeOptions.value[0]?.proxyPriceListFmt ?? []

  return [
    {
      title: $t('代理 IP 用途:'),
      name: 'businessUse',
      fullWidth: true,
      value: _businessOptions[0],
      props: {
        options: _businessOptions,
        placeholder: $t('任意用途'),
      },
      render: ({ item }: any) => {
        return (
          <div class="flex gap-col-3 gap-row-4 flex-wrap">
            {
              item.props.options.map((option: any) => {
                const content = (
                  <div class="flex flex-col items-center gap-0.5">
                    <div
                      class={`h-10 relative flex items-center gap-1.5 px-4 leading-none cursor-pointer select-none ${styles.radio} ${item.value.value === option.value ? styles.active : ''}`}
                      onClick={async () => {
                        item.value = option
                        await refreshFromScene(option.value)
                      }}
                    >
                      {option.badgeDesc && <div class={`absolute position-y-center top-0 -right-2 z-10 px-2 rounded-full ${styles[option.badgeClass]}`}>{option.badgeDesc}</div>}
                      {option.image && <RxImage class="block w-5" src={option.image} darkSrc={option.darkImage} alt={option.label} />}
                      <div class={`${styles.purpose}`}>{option.label}</div>
                    </div>
                    {option.isSpecialOffer && <div class="color-[#FF7A00] font-[DingTalk_JinBuTi] text-3.25 leading-3.5">{$t('🔥限时最低 $5.5/月')}</div>}
                  </div>
                )

                if (option.badgeDesc) {
                  return (
                    <RxTooltip>
                      {{
                        default: () => content,
                        content: () => <div class="w-76 color-[var(--component-tooltip-text-secondary)] whitespace-pre-wrap text-3 leading-4">{option.desc}</div>,
                      }}
                    </RxTooltip>
                  )
                }

                return content
              })
            }
          </div>
        )
      },
    },
    {
      title: () => {
        return (
          <div class="flex gap-4 items-center">
            <div class="tt-primary text-3.5 font-600 leading-normal whitespace-nowrap">
              {$t('选择代理 IP 国家/地区:')}
            </div>
            <RxInputText
              placeholder={$t('搜索国家/地区名称或代码')}
              class="!w-50"
              size="xs"
              leftIcon="base/rx_ic_magnify"
              modelValue={searchCountry.value}
              onUpdate:model-value={(val: string) => { searchCountry.value = val }}
            />
          </div>
        )
      },
      name: 'purchaseCountry',
      value: _countryOptions[0],
      fullWidth: true,
      props: {
        filter: true,
        disabled: _countryOptions.length === 1,
        options: _countryOptions,
        optionDisabled: (opt: any) => opt.status === ProxyStockStatus.Inactive,
      },
      render: ({ item }: any) => {
        const list = groupCountryOptionsByContinent(item.props.options)
        const searchContent = searchCountry.value

        if (searchContent) {
          const fuse = new Fuse(toRaw(item.props.options), {
            keys: [
              { name: 'country_name', weight: 2 }, // 权重更高，匹配成功排在前面
              { name: 'country_code', weight: 1 },
              { name: 'continent_name', weight: 0.5 },
            ],
            threshold: 0.3,
          })

          const result = fuse.search(searchContent).map(item => item.item)

          if (result.length > 0) {
            return (
              <div class="relative min-h-20 flex gap-3 flex-wrap">
                {result.map((option: any) => {
                  return (
                    <div
                      class={`h-10 relative flex items-center gap-1.5 leading-none px-3 cursor-pointer select-none ${styles.radio} ${item.value.value === option.value ? styles.active : ''}`}
                      onClick={async () => {
                        item.value = option
                        await refreshProxyTypesForCountry(option.value)
                      }}
                    >
                      {option.isNew && <div class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white">NEW</div>}
                      {option.isHot && <div class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white">HOT</div>}
                      <RxSvgIcon name={option.icon} size="18"></RxSvgIcon>
                      <div class={`${styles.purpose}`}>{option.name}</div>
                    </div>
                  )
                })}
              </div>
            )
          }
          else {
            return (
              <div class="relative flex items-center flex-col justify-center gap-2.5 py-12 bg-[var(--colors-background-bg-block)] rounded-2">
                <SvgIcon name="base/rx_ic_earth" size={32} color="var(--colors-icon-icon-inactive)"></SvgIcon>
                <div class="text-[var(--colors-text-text-inactive)] text-3">
                  {$t('抱歉，没有找到匹配结果。')}
                </div>
              </div>
            )
          }
        }

        return (
          <div class="relative min-h-20">
            <RxLoading modelValue={loadingPurchaseCountry.value} opacity={0.9} />
            <div class="flex flex-col gap-3">
              {
                list.map(group => (
                  <div class="flex flex-col gap-2">
                    <div class="tt-tertiary text-3.5 font-500 leading-5">{group.title}</div>
                    <div class="flex gap-3 flex-wrap">
                      {
                        group.items.map(option => (
                          <div
                            class={`h-10 relative flex items-center gap-1.5 leading-none px-3 cursor-pointer select-none ${styles.radio} ${item.value.value === option.value ? styles.active : ''}`}
                            onClick={async () => {
                              item.value = option
                              await refreshProxyTypesForCountry(option.value)
                            }}
                          >
                            {option.isNew && <div class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white">NEW</div>}
                            {option.isHot && <div class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white">HOT</div>}
                            <RxSvgIcon name={option.icon} size="18"></RxSvgIcon>
                            <div class={`${styles.purpose}`}>{option.name}</div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )
      },
    },
    {
      title: $t('选择 IP 时长:'),
      name: 'subscriptionMonths',
      value: _durationOptions[0],
      fullWidth: true,
      props: {
        options: _durationOptions,
      },
      render: ({ item }: any) => {
        return (
          <div class="flex gap-3">
            {item.props.options.map((option: any) => <div class={`h-10 flex items-center px-3 leading-none cursor-pointer select-none ${styles.period} ${styles.radio} ${item.value.value === option.value ? styles.active : ''}`} onClick={() => item.value = option}>{option.label}</div>)}
          </div>
        )
      },
    },
  ]
}

function inputPurchaseMember(value: number) {
  nextTick(() => {
    if (!value)
      purchaseMember.value = 1
  })
}

function checkStock() {
  const { purchaseCountry, businessUse } = configValue.value
  if ((currentProxyType.value.inventory ?? 0) > 0) {
    onPay()
    return
  }
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <SellOutModal proxyProviderId={provider.id} sceneId={businessUse.value} country={purchaseCountry.country_code.toLocaleUpperCase()} onClose={hideModal} onJump={toRola}></SellOutModal>,
    },
  })
}

async function onPay() {
  mixpanelTrack('click_confirm_proxy_ip_order')
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <WalletPayModal
          amount={finalResult.value.amount}
          onClose={hideModal}
          onConfirm={onConfirm}
        />
      ),
    },
  })

  async function onConfirm({ payType }: { payType: PayWay, isAuto: boolean }) {
    mixpanelTrack('click_pay_proxy_ip')
    const { subscriptionMonths, proxyProviderId, bandwidthSpeed, purchaseCountry, businessUse } = configValue.value
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate({
      entryType,
      purchaseMember: purchaseMember.value,
      subscriptionMonths: subscriptionMonths.value,
      payType,
      orderType: ProxyOrderType.Purchase,
      proxyProviderId: proxyProviderId.value,
      bandwidthSpeed: bandwidthSpeed.value,
      purchaseCountry: purchaseCountry.value,
      businessId: businessUse.value,
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent'))
      .then(() => {
        showFreedomActivityModal()
        emit('success', data)
        emit('close')
      })
  }
}
</script>

<template>
  <div class="relative flex-1 flex  gap-6 overflow-hidden">
    <RxLoading v-model="loading" :opacity="0.9" />
    <div class="py-5 flex-1 flex flex-col pl-8 gap-9 overflow-hidden overflow-y-auto">
      <div class="grid grid-cols-2 gap-y-6">
        <div v-for="item in configs" :key="item.name" class="flex flex-col gap-2" :class="[item.fullWidth ? 'col-span-2' : 'col-span-1']">
          <component :is="item.title" v-if="typeof item.title === 'function'" />
          <div v-else class="tt-primary text-3.5 font-600 leading-normal">
            {{ item.title }}
          </div>
          <component :is="item.render" v-if="item.render" :item="item" />
        </div>
      </div>
    </div>
    <div class="shrink-0 py-5 w-95 flex flex-col pr-8 gap-2 overflow-hidden overflow-y-auto">
      <RxAlert v-if="isCN" class="!w-full shrink-0 whitespace-pre-wrap" type="warn" :content="$t('检测到您当前网络环境位于中国大陆，当前代理 IP 暂不支持直连，请切换至海外网络后使用。\nRoxy 持续助力中国互联网环境健康发展，倡导安全、合规的网络环境。')" />
      <RxAlert v-if="isDirect" class="!w-full shrink-0" type="warn" :content="$t('专为跨境电商深度优化，仅可访问电商网站，限 Roxy 生态内合规使用。Roxy 持续助力中国跨境电商高质量发展，倡导安全、健康的互联网环境。')" />
      <div class="flex flex-col gap-2">
        <div v-if="proxyTypeValue != null" class="flex flex-col gap-1.5 pa-4 quantity">
          <div class="tt-primary text-3.5 font-600 leading-normal">
            {{ $t('代理 IP 数量:') }}
          </div>
          <RxStepInput v-model="purchaseMember" size="lg" :min="1" :max="Math.min(Math.max(1, currentProxyType.inventory), ONE_BUY_MAX)" @update:model-value="inputPurchaseMember" />
        </div>
        <Detail :list="details">
          <template #title="props">
            <div class="flex items-center gap-2">
              <div v-bind="props">
                {{ $t('代理 IP 信息') }}
              </div>
              <div v-if="isDirect" class="px-2 rounded-full" :class="styles.direct">
                {{ $t('大陆直连') }}
              </div>
            </div>
          </template>
          <template #type>
            <div class="relative">
              <RxLoading v-model="loadingProxyType" :opacity="0.1" />
              <div class="flex flex-col gap-1.5">
                <label v-for="item in proxyTypeOptions" :key="item.id" class="w-full flex items-start gap-1.5 select-none cursor-pointer" :for="`${CID}_${item.id}`">
                  <RadioButton v-model="proxyTypeValue" class="!hidden" :input-id="`${CID}_${item.id}`" :value="item.id" name="proxy-provider-type" />
                  <div class="w-full flex items-center gap-2 min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0 flex-1">
                      <div class="shrink-0 details-radio" :class="{ checked: proxyTypeValue === item.id }" />
                      <div class="tt-secondary text-3.5 leading-5 truncate" :class="{ premium: item.proxyType === ProxyIpType.Residential }">{{ item.typeName }}</div>
                      <SvgIcon v-if="item.desc" v-tooltip.top="item.desc" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
                    </div>
                    <component :is="formatProxyTypeUnitPrice(item)" />
                  </div>
                </label>
              </div>
            </div>
          </template>
          <template #speed="{ item }">
            <div class="flex flex-col gap-3">
              <RxDivider class="col-span-4" line-style="dashed" line-only line-color="var(--colors-border-divider-dashed)" />
              <div v-if="isDirect">
                <I18nT tag="div" class="tt-secondary font-[DingTalk_JinBuTi] text-3.5 leading-4 select-none" :keypath="$t('电商直连 IP 默认支持 {value}', { value: '{value}' })" scope="global">
                  <template #value>
                    <span class="bandwidth">100Mbps</span>
                  </template>
                </I18nT>
              </div>
              <template v-else>
                <div class="flex items-center gap-1">
                  <span class="tt-secondary text-3.5">{{ item.label }}</span>
                  <SvgIcon v-tooltip.top="$t('当前仅支持美国、香港、法国和日本的超高质量代理 IP 进行带宽升级。')" class="cursor-pointer" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
                </div>
                <div class="grid grid-cols-4 gap-1.5">
                  <div v-for="option in proxySpeedOptions" :key="option.value" v-tooltip.top="{ value: option.bandwidthSpeedDesc }"
                       class="col-span-2 h-10 flex items-center justify-center px-3 leading-none cursor-pointer select-none tt-primary !text-3.5"
                       :class="[styles.period, styles.radio, proxySpeedValue === option.value ? styles.active : '']" @click="proxySpeedValue = option.value"
                  >
                    {{ option.label }}
                  </div>
                </div>
              </template>
            </div>
          </template>

          <template #price="{ item }">
            <div class="flex justify-between items-center">
              <div class="details-label">
                {{ item.label }}
              </div>
              <div>
                <div class="details-price">
                  {{ item.value }}
                </div>
                <div v-if="item.diffValue > 0" class="details-diffprice">
                  {{ $t('节省 {value}', { value: currency(item.diffValue).format() }) }}
                </div>
              </div>
            </div>
          </template>
          <template #after>
            <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
              <div v-if="configValue.businessUse.isSpecialOffer" class="tt-inactive text-3 leading-5 text-center">
                {{ $t('请注意：当前代理 IP 为特价商品，不退不换') }}
              </div>
              <RxButton v-tooltip.top="!check('Cost_Center_all') && $t('暂无权限。如需开通，请联系团队拥有者，更改当前账号身份为管理者并开通‘费用中心’权限。')" size="lg" :disabled="!check('Cost_Center_all')" :label="$t('立即支付')"
                        @click="checkStock"
              />
              <I18nT tag="div" class="tt-tertiary text-3 leading-4.5 select-none" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
                <template #terms>
                  <a class="terms" :href="getOfficialWebsite('/copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
                </template>
              </I18nT>
            </div>
          </template>
        </Detail>
        <div class="flex flex-col gap-2">
          <div class="tt-primary text-3.5 font-600 leading-normal">
            {{ $t('注意事项:') }}
          </div>
          <ol class="ma-0 pl-4">
            <I18nT v-for="item in notes" :key="item.text" tag="li" class=" tt-tertiary text-3.25 leading-6" :keypath="item.text" scope="global">
              <template v-for="(bold, index) in item.bolds" :key="index" #[`bold${index}`]>
                <span class="tt-secondary font-bold">{{ bold }}</span>
              </template>
            </I18nT>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.stock {
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 16px;
  background: linear-gradient(90deg, #11a3fd 0%, #f047ff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.inventory {
  color: var(--colors-text-text-inactive);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.radio {
  border-radius: 8px;
  border: 3px solid var(--pattern-pay-plan-bg-bill);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  transition: all 0.3s;

  &:not(.active):hover {
    background: var(--colors-background-bg-action-hover);
  }

  &.active {
    border-color: var(--colors-border-border-brand);
    background: var(--pattern-pay-gradient-selected-start);
    box-shadow: none;

    .purpose,
    &.period {
      color: var(--colors-text-text-brand);
      font-weight: 600;
    }
  }
}

.purpose {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 500;
}

.period {
  color: var(--colors-text-text-primary);
  font-size: 16px;
}

.curated {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);
}

.direct {
  color: #34393d;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}
</style>

<style lang="scss" scoped>
.premium {
  font-size: 15px;
  font-family: 'DingTalk JinBuTi';
  background: linear-gradient(90deg, #e635f9 0%, #12a3fc 60.1%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.quantity {
  border-radius: 6px;
  border: 1px solid var(--colors-border-border-action, #c7d1d6);
  background: var(--colors-background-bg-action, #fff);

  :deep(.step) {
    border: none;
    gap: 24px;

    .p-inputtext {
      padding: 4px 0;
      font-size: 32px;
      font-weight: 600;
      box-shadow: none;

      &:focus,
      &:hover {
        border-radius: 4px;
        background: var(--colors-background-bg-action-hover);
      }
    }

    .p-button {
      box-shadow: none;

      svg {
        font-size: 32px;
        font-weight: 600;
      }

      &:disabled {
        background: transparent;
        opacity: 0.8;
      }
    }
  }
}

.bandwidth {
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.details {
  &-radio {
    position: relative;
    width: 16px;
    height: 16px;
    border: 1px solid var(--colors-border-border-brand);
    border-radius: 50%;

    &.checked {
      border-width: 2px;

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        background: var(--colors-border-border-brand);
        border-radius: 50%;
      }
    }
  }

  &-label {
    font-family: 'DingTalk JinBuTi';
    font-size: 15px;
    line-height: 16px;
    background: linear-gradient(90deg, #11a3fd 0%, #f047ff 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-price {
    color: #12a3fc;
    text-align: right;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-diffprice {
    color: var(--primitives-yellow-500);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.terms {
  color: var(--colors-text-text-brand);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: none;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>
