<script setup lang="tsx">
import RxButton from '/@/components/rx-button'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import RxStepInput from '/@/components/rx-step-input/index.vue';
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon'
import currency from 'currency.js';
import { $t } from '/@/locales'
import { API } from '/@/api';
import { addDays, format } from 'date-fns';
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale';
import { useNetworkStore } from '/@/stores/network'
import { PayWay } from '/@/enums/pay'
import { ProxyOrderType, ProxyStockStatus } from '/@/enums/proxy'
import { usePay } from '/@/views/pay/wallet/hook'
import { useThemeStore } from '/@/stores/theme'

const { data: provider = {} } = defineProps<{
  data: Record<string, any>
}>()

const emit = defineEmits(['back', 'close', 'success'])

const styles = useCssModule()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()
const { getOfficialWebsite } = useSimpleLocale()
const { realTheme } = storeToRefs(useThemeStore())
const { info: networkInfo } = storeToRefs(useNetworkStore())

const ONE_BUY_MAX = 1000
const configs = ref<any[]>([])
const loading = ref(false)

const notes = [
  {
    text: $t('所有代理都 {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('同时支持 SOCKS5 和 HTTP 协议')]
  },
  {
    text: $t('您购买的所有代理都是 {bold0}，不会与他人共享。', { bold0: '{bold0}' }),
    bolds: [$t('独享专用 IP')]
  },
  {
    text: $t('订阅期间所有代理 {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('不限流量')]
  },
  {
    text: $t('若购买的代理出现 {bold0} 的问题，支持 {bold1}。', { bold0: '{bold0}', bold1: '{bold1}' }),
    bolds: [$t('无法连接'), $t('免费更换或退款')]
  },
  {
    text: $t('您可以在代理列表中延长代理的使用期限，{bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('价格与购买时相同')]
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('代理过期后将被停用，无法找回或再次续费。')]
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('所有代理均由 RoxyBrowser 从 {name} 特挑。', { name: provider.proxyProviderName })]
  }
]

const isCN = computed(() => networkInfo.value.country_code === 'CN')
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

const totalAmount = computed(() => {
  const { subscriptionMonths, purchaseMember } = configValue.value
  return currency(subscriptionMonths.proxyPrice * purchaseMember).value
})

const details = computed(() => {
  const { purchaseCountry, subscriptionMonths, purchaseMember } = configValue.value
  return [
    {
      title: $t('代理 IP 信息'),
      items: [
        {
          label: $t('代理 IP 数量'),
          value: purchaseMember
        },
        {
          label: $t('国家/地区'),
          value: purchaseCountry.label
        },
        {
          label: $t('价格'),
          value: $t('{month}/个', { month: currency(subscriptionMonths.proxyPrice).format() })
        },
        {
          label: $t('续费价格'),
          value: $t('{month}/个', { month: currency(subscriptionMonths.proxyPrice).format() })
        },
      ]
    },
    {
      title: $t('订阅时长'),
      items: [
        {
          label: $t('订阅天数'),
          value: subscriptionMonths.label
        },
        {
          label: $t('开始时间'),
          value: format(new Date(), 'yyyy/MM/dd'),
        },
        {
          label: $t('到期时间'),
          value: format(addDays(new Date(), subscriptionMonths.day ?? 0), 'yyyy/MM/dd'),
        },
      ]
    },
    {
      items: [
        {
          label: $t('Roxy 独家特惠'),
          value: currency(totalAmount.value).format(),
          slot: 'price'
        },
      ]
    }
  ]
})

onMounted(async () => {
  configs.value = await initConfig()
})

async function initConfig() {
  loading.value = true
  const [purchaseCountry, businessUse, purchaseTimePrice] = await Promise.all([
    getCountryList(),
    getBusinessUseList(),
    getPurchaseTimePriceList(),
  ])
  loading.value = false

  const _purchaseCountry = purchaseCountry.map(item => ({
    ...item,
    icon: `country-code/${item.country_code?.toLocaleUpperCase()}`,
    label: `${item.country_name} / ${item.country_code.toLocaleUpperCase()}`,
    name: item.country_name,
    value: item.country_code,
    inventoryFmt:
      item.inventory > ONE_BUY_MAX
        ? $t('充足')
        : item.inventory === 0
          ? $t('库存不足')
          : $t('剩余 {count}', { count: item.inventory })
  }))

  const _businessUse = businessUse.map(item => ({
    image: item.proxyBusinessIcon,
    darkImage: item.proxyBusinessIconDark,
    label: item.proxyBusinessKey,
    value: item.proxyBusinessValue
  }))

  const _purchaseTimePrice = purchaseTimePrice.map(item => {
    const day = item.proxyPurchaseMonths * 30
    return { label: $t('{day} 天', { day }), value: item.proxyPurchaseMonths, day, ...item }
  })

  const updatePurchaseMember = (inventory: number) => {
    const purchaseMember = configs.value.find(item => item.name === 'purchaseMember')
    if (purchaseMember) {
      purchaseMember.value = Math.min(purchaseMember.value, inventory)
    }
  }

  return [
    {
      title: $t('选择代理 IP 国家/地区:'),
      name: 'purchaseCountry',
      value: _purchaseCountry[0],
      props: {
        filter: true,
        options: _purchaseCountry,
        optionDisabled: (opt: any) => opt.inventory <= 0,
      },
      render: ({ item }: any) => {
        const quicks = item.props.options.filter((item: any) => item.inventory > 0).slice(0, 3)
        return <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-6">
            <TsFormSelect class="!w-60" size="lg" v-model={item.value} {...item.props} onUpdate:modelValue={
              (opt: any) => {
                updatePurchaseMember(opt.inventory)
              }
            }>
              {{
                'option-extra': ({ option }: any) => <div class={`flex-1 text-right ${styles.stock}`}>{option.inventoryFmt}</div>
              }}
            </TsFormSelect>
            <div class="flex gap-2">
              {quicks.map((quick: any) => <RxButton class="!shadow-none" severity="secondary" onClick={
                () => {
                  item.value = quick
                  updatePurchaseMember(quick.inventory)
                }
              }>
                <RxSvgIcon name={quick.icon}></RxSvgIcon>
                <div>{quick.name}</div>
              </RxButton>)}
            </div>
          </div>
        </div>
      }
    },
    {
      title: $t('选择时长:'),
      name: 'subscriptionMonths',
      value: _purchaseTimePrice[0],
      props: {
        options: _purchaseTimePrice,
      },
      render: ({ item }: any) => {
        return <div class="flex gap-4">
          {item.props.options.map((option: any) => <div class={`px-5 py-2 cursor-pointer select-none ${styles.period} ${item.value.value === option.value ? styles.active : ''}`} onClick={() => item.value = option}>{option.label}</div>)}
        </div>
      }
    },
    {
      title: $t('代理 IP 数量:'),
      name: 'purchaseMember',
      value: 1,
      render: ({ item }: any) => <div class="flex items-center gap-4">
        <div class="w-40">
          <RxStepInput disabled={currentCountry.value.outOfStock} v-model={item.value} min={1} max={Math.min(currentCountry.value.inventory, ONE_BUY_MAX)} size="lg" onUpdate:modelValue={(value: number) => {
            nextTick(() => {
              if (!value) item.value = 1
            })
          }} />
        </div>
        <div class={styles.inventory}>{currentCountry.value.inventoryFmt}</div>
      </div>
    },
    {
      title: $t('代理 IP 用途:'),
      name: 'businessUse',
      props: {
        options: _businessUse,
        placeholder: $t('任意用途'),
      },
      render: ({ item }: any) => {
        return <TsFormSelect class="!w-60" size="lg" v-model={item.value} {...item.props} darkMode={realTheme.value === 'dark'} />
      }
    },
  ]
}

async function getCountryList() {
  const { code, data, msg } = await API.proxy.userGetProxyPurchaseCountryListList({ proxyProviderName: provider.proxyProviderName })
  onlyErrorToast(code, msg)
  if (code !== 0) return []
  return data
}

async function getBusinessUseList() {
  const { code, data, msg } = await API.proxy.userGetProxyBusinessUseListList()
  onlyErrorToast(code, msg)
  if (code !== 0) return []
  return data
}

async function getPurchaseTimePriceList() {
  const { code, data, msg } = await API.proxy.userGetProxyPurchaseTimePriceList()
  onlyErrorToast(code, msg)
  if (code !== 0) return []
  return data
}


async function onPay() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <WalletPayModal
        amount={totalAmount.value}
        onClose={hideModal}
        onConfirm={onConfirm}
      />,
    },
  })

  async function onConfirm({ payType }: any) {
    const { purchaseMember, subscriptionMonths, purchaseCountry, businessUse } = configValue.value
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate({
      purchaseMember,
      subscriptionMonths: subscriptionMonths.value,
      payType,
      orderType: ProxyOrderType.Purchase,
      proxyProviderId: provider.id,
      purchaseCountry: purchaseCountry.value,
      businessUse: businessUse?.value,
    })
    onlyErrorToast(code, msg)
    if (code !== 0) return
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent'))
      .then(() => {
        emit('close')
        emit('success', data)
      })
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-9 py-8 w-256 overflow-hidden">
    <div class="relative flex items-center gap-6 px-8">
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_arrow_left" @click="$emit('back')" />
      <div class="flex items-center gap-4">
        <img class="block w-14 h-14 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="provider.proxyProviderIcon" />
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="provider-name">{{ provider.proxyProviderName }}</span>
            <span class="provider-tag">{{ $t('静态住宅代理') }}</span>
          </div>
          <div class="provider-website">{{ provider.proxyProviderWebsite }}</div>
        </div>
      </div>
      <SvgIcon class="absolute right-8 top-0 cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="relative flex-1 flex gap-6 overflow-y-auto px-8">
      <RxLoading v-model="loading" :opacity="0.9"></RxLoading>
      <div class="flex-1 flex flex-col gap-9">
        <div class="flex flex-col gap-4" v-for="item in configs" :key="item.name">
          <div class="subtitle">{{ item.title }}</div>
          <component v-if="item.render" :is="item.render" :item="item" />
        </div>
        <div class="flex flex-col gap-2">
          <div class="subtitle">{{ $t('注意事项:') }}</div>
          <ol class="ma-0 pl-4">
            <i18n-t tag="li" class="notes" v-for="item in notes" :keypath="item.text" scope="global">
              <template v-for="(bold, index) in item.bolds" :key="index" #[`bold${index}`]>
                <span class="notes-bold">{{ bold }}</span>
              </template>
            </i18n-t>
          </ol>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <RxAlert v-if="isCN" class="!w-88" type="warn" :title="$t('温馨提示')" :content="$t('您当前的网络环境属于中国大陆，无法直连代理 IP。请确保实际使用时的网络环境可正常连接至代理 IP，再进行下单购买。')"></RxAlert>
        <Detail class="w-88" :list="details">
          <template #price="{ item }">
            <div class="flex justify-between items-center">
              <div class="details-label">{{ item.label }}</div>
              <div class="details-price">{{ item.value }}</div>
            </div>
          </template>
          <template #after>
            <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
              <RxButton size="lg" :disabled="currentCountry.outOfStock" :label="$t('立即支付')" @click="onPay"></RxButton>
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
    font-family: "JetBrains Mono";
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
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.notes {
  color: var(--colors-text-text-tertiary, #989CA0);
  font-size: 13px;
  line-height: 24px;

  &-bold {
    color: var(--colors-text-text-secondary);
    font-weight: bold;
  }
}

.details {
  &-label {
    font-family: "DingTalk JinBuTi";
    font-size: 15px;
    line-height: 16px;
    background: linear-gradient(90deg, #11A3FD 0%, #F047FF 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-price {
    color: #12A3FC;
    font-size: 24px;
    font-weight: 600;
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
