<script setup lang="tsx">
import RxLoading from '/@/components/rx-loading.vue'
import RxTooltip from '/@/components/rx-tooltip'
import RxButton from '/@/components/rx-button'
import RxImg from '/@/components/rx-image'
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
import { addDays, format } from 'date-fns'
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

const { data: provider = {}, entryType = BuyEntryType.Normal, toRola } = defineProps<{
  entryType?: BuyEntryType
  data?: Record<string, any>
  toRola: () => void
}>()

const emit = defineEmits(['close', 'success'])

const simpleLocale = useSimpleLocale()
const styles = useCssModule()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()
const { getOfficialWebsite } = useSimpleLocale()
const { currentLocale } = storeToRefs(useSimpleLocale())
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
].slice(0, provider.vendorName === 'Roxy IP' ? 6 : 7)

const configValue = computed(() => {
  const config = Object.fromEntries(configs.value.map(item => [item.name, item.value]))
  return {
    purchaseCountry: {},
    businessUse: {},
    subscriptionMonths: {},
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

const currentCountry = computed(() => {
  const { purchaseCountry } = configValue.value
  return {
    outOfStock: purchaseCountry.status === ProxyStockStatus.Inactive,
    ...purchaseCountry,
  }
})

const originalAmount = computed(() => {
  const { subscriptionMonths } = configValue.value
  return currency(subscriptionMonths.proxyPrice * purchaseMember.value).value
})

const finalAmount = computed(() => {
  const { proxyDiscount } = userPayInfo.value!
  return currency(originalAmount.value).multiply(discountCalculate([proxyDiscount])).value
})

const details = computed(() => {
  const { purchaseCountry, subscriptionMonths } = configValue.value
  const { proxyDiscount } = userPayInfo.value!

  return [
    {
      title: $t('代理 IP 信息'),
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
          label: $t('价格'),
          value: $t('{month}/个', { month: currency(subscriptionMonths.proxyPrice).format() }),
        },
      ],
    },
    {
      title: $t('订阅时长'),
      items: [
        {
          label: $t('订阅天数'),
          value: subscriptionMonths.label,
        },
        {
          label: $t('开始时间'),
          value: format(new Date(), 'yyyy/MM/dd'),
        },
        {
          label: $t('到期时间'),
          value: format(addDays(new Date(), subscriptionMonths.day ?? 0), 'yyyy/MM/dd'),
        },
      ],
    },
    {
      items: [
        {
          label: $t('专属折扣'),
          value: `-${proxyDiscount}%`,
          class: '!color-[#FC9D12]',
          visible: !!proxyDiscount,
        },
        {
          label: $t('Roxy 独家特惠'),
          value: currency(finalAmount.value).format(),
          diffValue: currency(originalAmount.value).subtract(finalAmount.value).value,
          slot: 'price',
        },
      ].filter(item => item.visible !== false),
    },
  ]
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
  })).filter((item) => {
    // 只要中文环境下，才显示 Direct 类型的代理 IP 用途
    if (item.badgeType === 'Direct') {
      return simpleLocale.currentLocale === 'zh-CN'
    }

    return true
  })
}

async function getProxyTypeList(sceneId: number) {
  const { code, data, msg } = await API.proxy.userGetProxyProvidersByBusinessSceneList({ sceneId: sceneId.toString() })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return []
  return data.map(item => ({
    ...item,
    value: item.id,
    label: item.typeName,
    desc: item.hoverText,
  }))
}

async function getCountryAndDurationList(proxyProviderId: number) {
  const { code, data, msg } = await API.proxy.userGetProxyCountryListByContinentList({ proxyProviderId: proxyProviderId.toString() })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return []

  return data.map(item => ({
    ...item,
    isNew: item.isNew,
    isHot: item.isHot,
    icon: `country-code/${item.country_code?.toLocaleUpperCase()}`,
    label: `${item.country_name} / ${item.country_code?.toLocaleUpperCase()}`,
    name: currentLocale.value === 'zh-CN' ? item.country_name : item.country_code?.toLocaleUpperCase(),
    value: item.country_code,
    proxyPriceListFmt: item.proxyPriceList.map((item) => {
      const day = item.proxyPurchaseMonths * 30
      return { label: $t('{day} 天', { day }), value: item.proxyPurchaseMonths, day, ...item }
    }),
    proxyTpyeStr: item.proxyTpye === ProxyIpType.Residential ? $t('原生 IP') : '',
  }))
}

interface ProxyPurchaseCascade {
  typeOptions: any[]
  countryOptions: any[]
}

/** 购买弹窗内：按供应商 + 用途/类型 缓存代理类型级联与地区列表，避免反复切换时重复请求 */
function createProxyPurchaseDataCache(options: {
  getProxyTypeList: (sceneId: number) => Promise<any[]>
  fetchCountryList: (proxyProviderId: number) => Promise<any[]>
  vendorId: () => string | number | undefined
}) {
  const cascadeByScene = new Map<string, ProxyPurchaseCascade>()
  const countryBySceneType = new Map<string, any[]>()

  const joinKey = (parts: (string | number)[]) => parts.join(':')

  function snapshot<T>(v: T): T {
    return structuredClone(v)
  }

  async function getCountryList(sceneId: number, proxyProviderId: number) {
    const k = joinKey([options.vendorId() ?? '', sceneId, proxyProviderId])
    const hit = countryBySceneType.get(k)
    if (hit) {
      return snapshot(hit)
    }
    const data = await options.fetchCountryList(proxyProviderId)
    countryBySceneType.set(k, snapshot(data))
    return snapshot(data)
  }

  async function getCascade(sceneId: number) {
    const k = joinKey([options.vendorId() ?? '', sceneId])
    const hit = cascadeByScene.get(k)
    if (hit) {
      return snapshot(hit)
    }
    const typeOptions = await options.getProxyTypeList(sceneId)
    const countryOptions = typeOptions[0]
      ? await getCountryList(sceneId, typeOptions[0].value as number)
      : []
    const row: ProxyPurchaseCascade = { typeOptions, countryOptions }
    cascadeByScene.set(k, snapshot(row))
    return snapshot(row)
  }

  return { getCascade, getCountryList }
}

const proxyPurchaseDataCache = createProxyPurchaseDataCache({
  getProxyTypeList,
  fetchCountryList: getCountryAndDurationList,
  vendorId: () => provider.id,
})

async function initConfig() {
  loading.value = true

  const _businessOptions = await getBusinessUseList(provider.id)
  const { typeOptions: _typeOptions, countryOptions: _countryOptions } = await proxyPurchaseDataCache.getCascade(_businessOptions[0].value)
  const _durationOptions = _countryOptions[0]?.proxyPriceListFmt || []

  loading.value = false

  const _updatePurchaseMember = (inventory: number) => {
    purchaseMember.value = Math.min(purchaseMember.value, Math.max(inventory, 1))
  }

  const _updateSubscriptionMonths = (options: any[]) => {
    const subscriptionMonths = configs.value.find(item => item.name === 'subscriptionMonths')
    if (subscriptionMonths) {
      subscriptionMonths.value = options[0]
      subscriptionMonths.props.options = options
    }
  }

  const findCfg = (name: string) => configs.value.find(c => c.name === name)

  function syncQuantityAndDurationFromCountry(country: any) {
    _updatePurchaseMember(country?.inventory ?? 0)
    _updateSubscriptionMonths(country?.proxyPriceListFmt || [])
  }

  function applyProxyTypeOptions(typeOptions: any[]) {
    const cfg = findCfg('proxyProviderId')
    if (!cfg)
      return
    cfg.value = typeOptions[0]
    cfg.props.options = typeOptions
    cfg.props.disabled = typeOptions.length === 1
  }

  function applyPurchaseCountryList(countryOptions: any[]) {
    const cfg = findCfg('purchaseCountry')
    if (cfg) {
      cfg.value = countryOptions[0]
      cfg.props.options = countryOptions
      cfg.props.disabled = countryOptions.length === 1
    }
    syncQuantityAndDurationFromCountry(countryOptions[0])
  }

  async function refreshFromScene(sceneId: number) {
    loadingProxyType.value = true
    loadingPurchaseCountry.value = true
    try {
      const { typeOptions, countryOptions } = await proxyPurchaseDataCache.getCascade(sceneId)
      applyProxyTypeOptions(typeOptions)
      applyPurchaseCountryList(countryOptions)
    }
    finally {
      loadingProxyType.value = false
      loadingPurchaseCountry.value = false
    }
  }

  async function refreshCountriesForProxyProvider(proxyProviderId: number) {
    loadingPurchaseCountry.value = true
    try {
      const sceneId = findCfg('businessUse')?.value?.value
      const countryOptions
        = sceneId != null
          ? await proxyPurchaseDataCache.getCountryList(sceneId, proxyProviderId)
          : await getCountryAndDurationList(proxyProviderId)
      applyPurchaseCountryList(countryOptions)
    }
    finally {
      loadingPurchaseCountry.value = false
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
          <div class="flex gap-3 flex-wrap">
            {
              item.props.options.map((option: any) => (
                <div
                  class={`h-10 relative flex items-center gap-1.5 px-4 leading-none cursor-pointer select-none  ${styles.radio} ${item.value.value === option.value ? styles.active : ''}`}
                  onClick={async () => {
                    item.value = option
                    await refreshFromScene(option.value)
                  }}
                >
                  {option.badgeDesc && (
                    <RxTooltip class="position-y-center top-0 -right-2 z-10">
                      {{
                        default: () => <div class={`py-0.5 px-2 rounded-full ${styles[option.badgeClass]}`}>{option.badgeDesc}</div>,
                        content: () => <div class="w-76 color-[var(--component-tooltip-text-secondary)] whitespace-pre-wrap text-3 leading-4">{option.desc}</div>,
                      }}
                    </RxTooltip>
                  )}
                  {option.image && <RxImg class="block w-5" src={option.image} darkSrc={option.darkImage} alt={option.label} />}
                  <div class={`${styles.purpose}`}>{option.label}</div>
                </div>
              ))
            }
          </div>
        )
      },
    },
    {
      title: $t('代理 IP 类型:'),
      name: 'proxyProviderId',
      value: _typeOptions[0],
      fullWidth: true,
      props: {
        options: _typeOptions,
        disabled: _typeOptions.length === 1,
      },
      render: ({ item }: any) => {
        return (
          <div class="relative min-h-12">
            <RxLoading modelValue={loadingProxyType.value} opacity={0.9} />
            <div class="flex gap-3 flex-wrap">
              {
                item.props.options.map((option: any) => (

                  <RxTooltip>
                    {{
                      default: () => (
                        <div
                          class={`h-12 flex items-center leading-none max-w-68 gap-1 px-4 cursor-pointer select-none ${styles.type_title} ${styles.radio} ${item.value.value === option.value ? styles.active : ''}`}
                          onClick={async () => {
                            item.value = option
                            await refreshCountriesForProxyProvider(option.value)
                          }}
                        >
                          {option.label}
                        </div>
                      ),
                      content: () => <div class="w-76 color-[var(--component-tooltip-text-secondary)] whitespace-pre-wrap text-3 leading-4">{option.desc}</div>,
                    }}
                  </RxTooltip>

                ))
              }
            </div>
          </div>
        )
      },
    },
    {
      title: () => {
        return (
          <div class="flex gap-4 items-center">
            <div class="subtitle whitespace-nowrap">
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
        optionDisabled: (opt: any) => opt.inventory <= 0,
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
                      onClick={() => {
                        item.value = option
                        syncQuantityAndDurationFromCountry(option)
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
                            onClick={() => {
                              item.value = option
                              syncQuantityAndDurationFromCountry(option)
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
  if (purchaseCountry.inventory > 0) {
    // checkCommerceIP()
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

// async function checkCommerceIP() {
//   const { businessUse } = configValue.value
//   if (businessUse.badgeType !== 'Direct') {
//     onPay()
//     return
//   }
//   showModal({
//     showHeader: false,
//     modal: true,
//     blockScroll: true,
//     slots: {
//       container: ({ hideModal }) => {
//         return (
//           <div class="flex flex-col pt-4 pb-6 px-6 gap-5 w-100">
//             <div class="relative flex items-center h-9">
//               <span class="tt-primary text-4 font-700">{$t('温馨提示')}</span>
//               <span class="absolute right-0 cursor-pointer" onClick={hideModal}>
//                 <RxSvgIcon size="20" name="base/rx_ic_delete"></RxSvgIcon>
//               </span>
//             </div>
//             <div class="tt-primary text-3.5 leading-6 whitespace-pre-wrap">
//               <I18nT scope="global" keypath={$t('您当前选择的是电商专用 IP，该 IP {available}跨境电商网站，{notAvailable}非跨境电商类境外网站。请确认用途后继续购买。', { available: '{available}', notAvailable: '{notAvailable}' })}>
//                 {{
//                   available: () => <span class="font-bold">{$t('仅可访问 Amazon 等')}</span>,
//                   notAvailable: () => <span class="font-bold">{$t('不支持访问 Google、社交平台等')}</span>,
//                 }}
//               </I18nT>
//             </div>
//             <div class="flex justify-end gap-2">
//               <RxButton outlined severity="secondary" size="md" label={$t('取消')} onClick={hideModal}></RxButton>
//               <RxButton
//                 size="md"
//                 label={$t('确认购买')}
//                 onClick={() => {
//                   hideModal()
//                   onPay()
//                 }}
//               >
//               </RxButton>
//             </div>
//           </div>
//         )
//       },
//     },
//   })
// }

async function onPay() {
  mixpanelTrack('click_confirm_proxy_ip_order')
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <WalletPayModal
          amount={finalAmount.value}
          onClose={hideModal}
          onConfirm={onConfirm}
        />
      ),
    },
  })

  async function onConfirm({ payType }: { payType: PayWay, isAuto: boolean }) {
    mixpanelTrack('click_pay_proxy_ip')
    const { subscriptionMonths, proxyProviderId, purchaseCountry, businessUse } = configValue.value
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate({
      entryType,
      purchaseMember: purchaseMember.value,
      subscriptionMonths: subscriptionMonths.value,
      payType,
      orderType: ProxyOrderType.Purchase,
      proxyProviderId: proxyProviderId.value,
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
          <div v-else class="subtitle">
            {{ item.title }}
          </div>
          <component :is="item.render" v-if="item.render" :item="item" />
        </div>
      </div>
    </div>
    <div class="py-5 w-88 flex flex-col pr-8 gap-2 overflow-hidden overflow-y-auto">
      <RxAlert v-if="isCN" class="!w-full shrink-0 whitespace-pre-wrap" type="warn" :title="$t('温馨提示')" :content="$t('检测到您当前网络环境位于中国大陆，当前代理 IP 暂不支持直连，请切换至海外网络后使用。\nRoxy 持续助力中国互联网环境健康发展，倡导安全、合规的网络环境。')" />
      <RxAlert v-if="isDirect" class="!w-full shrink-0" type="warn" :title="$t('温馨提示')" :content="$t('电商专用 IP 专为跨境电商深度优化，仅可访问电商网站，限 Roxy 生态内合规使用。Roxy 持续助力中国跨境电商高质量发展，倡导安全、健康的互联网环境。')" />
      <div class="flex flex-col gap-6">
        <div v-if="currentCountry" class="flex flex-col gap-1.5 pa-4 quantity">
          <div class="subtitle">
            {{ $t('代理 IP 数量:') }}
          </div>
          <RxStepInput v-model="purchaseMember" size="lg" :disabled="currentCountry.outOfStock" :min="1" :max="Math.min(Math.max(1, currentCountry.inventory), ONE_BUY_MAX)"
                       @update:model-value="inputPurchaseMember"
          />
        </div>
        <Detail :list="details">
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
              <RxButton v-tooltip.top="!check('Cost_Center_all') && $t('暂无权限。如需开通，请联系工作空间拥有者，更改当前账号身份为管理者并开通‘费用中心’权限。')" size="lg" :disabled="!check('Cost_Center_all')" :label="$t('立即支付')"
                        @click="checkStock"
              />
              <I18nT tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
                <template #terms>
                  <a class="terms-link" :href="getOfficialWebsite('/copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
                </template>
              </I18nT>
            </div>
          </template>
        </Detail>
        <div class="flex flex-col gap-2">
          <div class="subtitle">
            {{ $t('注意事项:') }}
          </div>
          <ol class="ma-0 pl-4">
            <I18nT v-for="item in notes" :key="item.text" tag="li" class="notes" :keypath="item.text" scope="global">
              <template v-for="(bold, index) in item.bolds" :key="index" #[`bold${index}`]>
                <span class="notes-bold">{{ bold }}</span>
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
  border: 3px solid var(--colors-background-bg-page);
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
    &.type_title,
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

.curated {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);
}

.direct {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}

.type_title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  // line-height: 24px;
}

.period {
  color: var(--colors-text-text-primary);
  font-size: 16px;
}
</style>

<style lang="scss" scoped>
.provider {
  &-name {
    color: var(--colors-text-text-primary);
    font-size: 20px;
    font-weight: 600;
    line-height: normal;
  }

  &-tag {
    display: flex;
    padding: 1px 4px;
    justify-content: center;
    align-items: center;
    border-radius: 2px;
    border: 1px solid var(--component-tag-border);
    background: var(--component-tag-bg);
    color: var(--component-tag-text);
    font-family: 'JetBrains Mono';
    font-size: 10px;
    font-weight: 800;
    line-height: normal;
  }

  &-website {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: normal;
  }
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
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

.details {
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
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 18px;

  &-link {
    color: var(--colors-text-text-brand);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}

.notes {
  color: var(--colors-text-text-tertiary, #989ca0);
  font-size: 13px;
  line-height: 24px;

  &-bold {
    color: var(--colors-text-text-secondary);
    font-weight: bold;
  }
}
</style>
