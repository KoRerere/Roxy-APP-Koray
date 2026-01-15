<script setup lang="tsx">
import RxButton from '/@/components/rx-button'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import RxStepInput from '/@/components/rx-step-input/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon'
import currency from 'currency.js'

import { API } from '/@/api'
import { addDays, format } from 'date-fns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
import { useNetworkStore } from '/@/stores/network'
import { useUserStore } from '/@/stores/user'
import { PayWay } from '/@/enums/pay'
import { BuyEntryType, ProxyOrderType, ProxyStockStatus } from '/@/enums/proxy'
import { usePay } from '/@/views/pay/wallet/hook'
import { useThemeStore } from '/@/stores/theme'
import { discountCalculate } from '/@/views/pay/subscribe/util'

const { data: provider = {}, entryType = BuyEntryType.Normal } = defineProps<{
  entryType?: BuyEntryType
  data?: Record<string, any>
}>()

const emit = defineEmits(['back', 'close', 'success'])

const styles = useCssModule()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()
const { getOfficialWebsite } = useSimpleLocale()
const { realTheme } = storeToRefs(useThemeStore())
const { info: networkInfo } = storeToRefs(useNetworkStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()

const ONE_BUY_MAX = 1000
const configs = ref<any[]>([])
const loading = ref(false)

const notes = [
  {
    text: $t('所有代理都 {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('同时支持 SOCKS5 和 HTTP 协议')],
  },
  {
    text: $t('您购买的所有代理都是 {bold0}，不会与他人共享。', { bold0: '{bold0}' }),
    bolds: [$t('独享专用 IP')],
  },
  {
    text: $t('订阅期间所有代理 {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('不限流量')],
  },
  {
    text: $t('若购买的代理出现 {bold0} 的问题，支持 {bold1}。', { bold0: '{bold0}', bold1: '{bold1}' }),
    bolds: [$t('无法连接'), $t('免费更换或退款')],
  },
  {
    text: $t('您可以在代理列表中延长代理的使用期限，{bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('价格与购买时相同')],
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('代理过期后将被停用，无法找回或再次续费。')],
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('所有代理均由 RoxyBrowser 从 {name} 特挑。', { name: provider.proxyProviderName })],
  },
].slice(0, provider.proxyProviderName === 'RoxyBrowser' ? 6 : 7)

const durationOptionsMap = new Map()

const isCN = computed(() => networkInfo.value?.country_code === 'CN')
const configValue = computed(() => {
  const config = Object.fromEntries(configs.value.map(item => [item.name, item.value]))
  return {
    purchaseCountry: {},
    businessUse: {},
    subscriptionMonths: {},
    purchaseMember: 1,
    ...config,
  }
})

const currentCountry = computed(() => {
  const { purchaseCountry } = configValue.value
  return {
    outOfStock: purchaseCountry.status === ProxyStockStatus.Inactive,
    ...purchaseCountry,
  }
})

const originalAmount = computed(() => {
  const { subscriptionMonths, purchaseMember } = configValue.value
  return currency(subscriptionMonths.proxyPrice * purchaseMember).value
})

const finalAmount = computed(() => {
  const { proxyDiscount } = userPayInfo.value!
  return currency(originalAmount.value).multiply(discountCalculate([proxyDiscount])).value
})

const details = computed(() => {
  const { purchaseCountry, subscriptionMonths, purchaseMember } = configValue.value
  const { proxyDiscount } = userPayInfo.value!

  return [
    {
      title: $t('代理 IP 信息'),
      items: [
        {
          label: $t('代理 IP 数量'),
          value: purchaseMember,
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
  mixpanelTrack('click_buy_proxy_ip')
  configs.value = await initConfig()
})

async function initConfig() {
  loading.value = true
  const _typeOptions = provider.proxyTypeList.map((item: any) => ({
    ...item,
    value: item.id,
    label: item.typeName,
  }))
  const [_countryOptions, _businessOptions, _durationOptions] = await Promise.all([
    getCountryList(),
    getBusinessUseList(),
    getPurchaseTimePriceList(_typeOptions[0].value),
  ])
  loading.value = false

  const updatePurchaseMember = (inventory: number) => {
    const purchaseMember = configs.value.find(item => item.name === 'purchaseMember')
    if (purchaseMember) {
      purchaseMember.value = Math.min(purchaseMember.value, inventory)
    }
  }

  return [
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
          <TsFormSelect
            class="!w-60"
            size="md"
            v-model={item.value}
            {...item.props}
            onUpdate:modelValue={
              async (opt: any) => {
                const _durationOptions = await getPurchaseTimePriceList(opt.value)
                const subscriptionMonths = configs.value.find(item => item.name === 'subscriptionMonths')
                if (subscriptionMonths) {
                  subscriptionMonths.value = _durationOptions[0]
                  subscriptionMonths.props.options = _durationOptions
                }
              }
            }
          />
        )
      },
    },
    {
      title: $t('选择代理 IP 国家/地区:'),
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
        const quicks = item.props.options.filter((item: any) => item.inventory > 0).slice(0, 3)
        return (
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-6">
              <TsFormSelect class="!w-60" size="md" v-model={item.value} {...item.props} onUpdate:modelValue={(opt: any) => updatePurchaseMember(opt.inventory)}>
                {{
                  'option-extra': ({ option }: any) => <div class={`flex-1 text-right ${styles.stock}`}>{option.inventoryFmt}</div>,
                }}
              </TsFormSelect>
              {
                quicks.length > 1 && (
                  <div class="flex gap-2">
                    {
                      quicks.map((quick: any) => (
                        <RxButton
                          class="!shadow-none"
                          severity="secondary"
                          onClick={() => {
                            item.value = quick
                            updatePurchaseMember(quick.inventory)
                          }}
                        >
                          <RxSvgIcon name={quick.icon}></RxSvgIcon>
                          <div>{quick.name}</div>
                        </RxButton>
                      ))
                    }
                  </div>
                )
              }
            </div>
          </div>
        )
      },
    },
    {
      title: $t('选择时长:'),
      name: 'subscriptionMonths',
      value: _durationOptions[0],
      fullWidth: true,
      props: {
        options: _durationOptions,
      },
      render: ({ item }: any) => {
        return (
          <div class="flex gap-4">
            {item.props.options.map((option: any) => <div class={`px-5 py-1.5 cursor-pointer select-none ${styles.period} ${item.value.value === option.value ? styles.active : ''}`} onClick={() => item.value = option}>{option.label}</div>)}
          </div>
        )
      },
    },
    {
      title: $t('代理 IP 数量:'),
      name: 'purchaseMember',
      value: 1,
      fullWidth: true,
      render: ({ item }: any) => (
        <div class="flex items-center gap-4">
          <div class="w-40">
            <RxStepInput
              disabled={currentCountry.value.outOfStock}
              v-model={item.value}
              min={1}
              max={Math.min(currentCountry.value.inventory, ONE_BUY_MAX)}
              size="md"
              onUpdate:modelValue={(value: number) => {
                nextTick(() => {
                  if (!value)
                    item.value = 1
                })
              }}
            />
          </div>
          <div class={styles.inventory}>{currentCountry.value.inventoryFmt}</div>
        </div>
      ),
    },
    {
      title: $t('代理 IP 用途:'),
      name: 'businessUse',
      fullWidth: true,
      props: {
        options: _businessOptions,
        placeholder: $t('任意用途'),
      },
      render: ({ item }: any) => {
        return <TsFormSelect class="!w-60" size="md" v-model={item.value} {...item.props} darkMode={realTheme.value === 'dark'} />
      },
    },
  ]
}

async function getCountryList() {
  const { code, data, msg } = await API.proxy.userGetProxyPurchaseCountryListList({ proxyProviderName: provider.proxyProviderName })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return []

  return data.map(item => ({
    ...item,
    icon: `country-code/${item.country_code?.toLocaleUpperCase()}`,
    label: `${item.country_name} / ${item.country_code?.toLocaleUpperCase()}`,
    name: item.country_name,
    value: item.country_code,
    inventoryFmt:
      item.inventory > ONE_BUY_MAX
        ? $t('充足')
        : item.inventory === 0
          ? $t('库存不足')
          : $t('剩余 {count}', { count: item.inventory }),
  }))
}

async function getBusinessUseList() {
  const { code, data, msg } = await API.proxy.userGetProxyBusinessUseListList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return []
  return data.map(item => ({
    image: item.proxyBusinessIcon,
    darkImage: item.proxyBusinessIconDark,
    label: item.proxyBusinessKey,
    value: item.proxyBusinessValue,
  }))
}

async function getPurchaseTimePriceList(proxyProviderId: string) {
  if (durationOptionsMap.has(proxyProviderId)) {
    return durationOptionsMap.get(proxyProviderId)
  }
  const { code, data, msg } = await API.proxy.userGetProxyPurchaseTimePriceList({ proxyProviderId })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return []
  const _data = data.map((item) => {
    const day = item.proxyPurchaseMonths * 30
    return { label: $t('{day} 天', { day }), value: item.proxyPurchaseMonths, day, ...item }
  })
  durationOptionsMap.set(proxyProviderId, _data)
  return _data
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
          amount={finalAmount.value}
          onClose={hideModal}
          onConfirm={onConfirm}
        />
      ),
    },
  })

  async function onConfirm({ payType }: any) {
    mixpanelTrack('click_pay_proxy_ip')
    const { purchaseMember, subscriptionMonths, proxyProviderId, purchaseCountry, businessUse } = configValue.value
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate({
      entryType,
      purchaseMember,
      subscriptionMonths: subscriptionMonths.value,
      payType,
      orderType: ProxyOrderType.Purchase,
      proxyProviderId: proxyProviderId.value,
      purchaseCountry: purchaseCountry.value,
      businessUse: businessUse?.value,
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent'))
      .then(() => {
        emit('success', data)
        emit('close')
      })
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-9 py-8 w-256 overflow-hidden">
    <div class="relative flex items-center gap-6 px-8">
      <SvgIcon v-if="entryType !== BuyEntryType.Immediate" class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_arrow_left" @click="$emit('back')" />
      <div class="flex items-center gap-4">
        <img class="block w-14 h-14 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="provider.proxyProviderIcon">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="provider-name">{{ provider.proxyProviderName }}</span>
            <div class="flex gap-2">
              <span v-for="item in provider.proxyTypeList" :key="item.typeName" class="provider-tag">{{ item.typeName }}</span>
            </div>
          </div>
          <div class="provider-website">
            {{ provider.proxyProviderWebsite }}
          </div>
        </div>
      </div>
      <SvgIcon class="absolute right-8 top-0 cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="relative flex-1 flex gap-6 overflow-y-auto px-8">
      <RxLoading v-model="loading" :opacity="0.9" />
      <div class="flex-1 flex flex-col gap-9">
        <div class="grid grid-cols-2 gap-y-6">
          <div v-for="item in configs" :key="item.name" class="flex flex-col gap-2" :class="[item.fullWidth ? 'col-span-2' : 'col-span-1']">
            <div class="subtitle">
              {{ item.title }}
            </div>
            <component :is="item.render" v-if="item.render" :item="item" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <div class="subtitle">
            {{ $t('注意事项:') }}
          </div>
          <ol class="ma-0 pl-4">
            <i18n-t v-for="item in notes" :key="item.text" tag="li" class="notes" :keypath="item.text" scope="global">
              <template v-for="(bold, index) in item.bolds" :key="index" #[`bold${index}`]>
                <span class="notes-bold">{{ bold }}</span>
              </template>
            </i18n-t>
          </ol>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <RxAlert v-if="isCN" class="!w-88 shrink-0" type="warn" :title="$t('温馨提示')" :content="$t('您当前的网络环境属于中国大陆，无法直连代理 IP。请确保实际使用时的网络环境可正常连接至代理 IP，再进行下单购买。')" />
        <Detail class="w-88" :list="details">
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
              <RxButton size="lg" :disabled="currentCountry.outOfStock" :label="$t('立即支付')" @click="onPay" />
              <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
                <template #terms>
                  <a class="terms-link" :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
                </template>
              </i18n-t>
            </div>
          </template>
        </Detail>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.stock {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}

.inventory {
  color: var(--colors-text-text-inactive);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.period {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  color: var(--colors-text-text-primary);
  font-size: 16px;
  line-height: 24px;

  &.active {
    border-color: var(--colors-border-border-brand);
    color: var(--colors-text-text-brand);
  }
}

.notes {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 20px;
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

.notes {
  color: var(--colors-text-text-tertiary, #989ca0);
  font-size: 13px;
  line-height: 24px;

  &-bold {
    color: var(--colors-text-text-secondary);
    font-weight: bold;
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
</style>
