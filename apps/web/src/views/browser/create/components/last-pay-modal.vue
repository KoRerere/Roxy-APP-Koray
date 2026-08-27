<script setup lang="tsx">
import RxButton from '/@/components/rx-button'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import RxStepInput from '/@/components/rx-step-input/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'

import { API } from '/@/api'
import { addDays, format } from 'date-fns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
import { useNetworkStore } from '/@/stores/network'
import { useUserStore } from '/@/stores/user'
import { PayWay } from '/@/enums/pay'
import { BuyEntryType, BuyProxyListType, ProxyOrderType } from '/@/enums/proxy'
import { usePay } from '/@/views/pay/wallet/hook'
import { purchaseMonthsToDays } from '/@/views/pay/subscribe/util'
import { getProxyPurchaseNotes } from '/@/views/agent/shop/utils/proxy-purchase-notes'
import ExclusivePriceRow from '/@/views/campaign/new-user/exclusive-price-row.vue'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { calcProxyPayAmount } from '/@/views/campaign/new-user/proxy-pricing'

const {
  data: initialData,
  entryType = BuyEntryType.Immediate,
  isDirect = false,
} = defineProps<{
  data: Record<string, any>
  entryType?: BuyEntryType
  isDirect?: boolean
}>()
const emit = defineEmits(['close', 'success'])

const styles = useCssModule()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()
const { getOfficialWebsite } = useSimpleLocale()
const { info: networkInfo } = storeToRefs(useNetworkStore())
const { userPayInfo } = storeToRefs(useUserStore())
const newUserBenefitStore = useNewUserBenefitStore()

const ONE_BUY_MAX = 1000
const proxyData = ref({ ...initialData })
const countryList = ref<any[]>([])
const configs = ref<any[]>([])
const loading = ref(false)

const canSwitchCountry = computed(() => countryList.value.length > 1)

const notes = computed(() => getProxyPurchaseNotes())

const isCN = computed(() => networkInfo.value?.country_code === 'CN' && !isDirect)
const configValue = computed(() => {
  const config = Object.fromEntries(configs.value.map(item => [item.name, item.value]))
  return {
    purchaseCountry: {
      label: proxyData.value.purchaseCountry.label,
      value: proxyData.value.purchaseCountry.value,
      countryCode: proxyData.value.purchaseCountry.value.toLocaleUpperCase(),
    },
    businessId: proxyData.value.businessId,
    proxyProviderId: proxyData.value.proxyProviderId,
    subscriptionMonths: {},
    purchaseMember: 1,
    ...config,
  }
})

/** 住宅 30 天、仍有额度，且国家在 residentialCountries 白名单内才走首条新人价 */
const newUserIpOfferActive = computed(() => {
  return newUserBenefitStore.isNewUserIpOffer(
    'residential',
    configValue.value.subscriptionMonths?.day ?? 0,
    configValue.value.purchaseCountry?.value,
  )
})

const payResult = computed(() => {
  const { subscriptionMonths, purchaseMember } = configValue.value
  const { proxyDiscount = 0 } = userPayInfo.value!
  return calcProxyPayAmount({
    offerActive: newUserIpOfferActive.value,
    quantity: purchaseMember,
    unitPrice: subscriptionMonths.proxyPrice ?? 0,
    originalUnitPrice: subscriptionMonths.originalProxyPrice || subscriptionMonths.proxyPrice || 0,
    newUserUnitPrice: newUserBenefitStore.newUserIpUnitPrice('residential'),
    bandwidthAmount: 0,
    proxyDiscount,
  })
})

const finalAmount = computed(() => payResult.value.amount)

/** 有福利时 1 条展示新人价/原价划线，≥2 条只展示原价 */
const ipUnitDisplay = computed(() => {
  const { subscriptionMonths, purchaseMember } = configValue.value
  const catalog = subscriptionMonths.originalProxyPrice || subscriptionMonths.proxyPrice
  if (!newUserIpOfferActive.value) {
    return {
      price: subscriptionMonths.proxyPrice,
      original: catalog,
      showOriginal: subscriptionMonths.proxyPrice < catalog,
    }
  }
  if (purchaseMember >= 2)
    return { price: catalog, original: catalog, showOriginal: false }
  const newPrice = newUserBenefitStore.newUserIpUnitPrice('residential')
  return { price: newPrice, original: catalog, showOriginal: newPrice < catalog }
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
          slot: 'ipUnitPrice',
        },
        {
          label: $t('首条 IP 享受 {price} 新用户价，不与其他折扣叠加', {
            price: currency(newUserBenefitStore.newUserIpUnitPrice('residential')).format(),
          }),
          visible: newUserIpOfferActive.value && purchaseMember >= 2,
          class: '!tt-tertiary !text-3',
        },
      ].filter(item => item.visible !== false),
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
          visible: !!proxyDiscount && !(newUserIpOfferActive.value && purchaseMember <= 1),
        },
        {
          label: $t('Roxy 独家特惠'),
          value: currency(payResult.value.amount).format(),
          diffValue: payResult.value.diffAmount,
          slot: 'price',
        },
      ].filter(item => item.visible !== false),
    },
  ]
})

onMounted(async () => {
  configs.value = await initConfig()
})

function createDurationConfig(data: Record<string, any>) {
  const _durationOptions = data.proxyPriceList.map((item: any) => {
    const day = purchaseMonthsToDays(item.proxyPurchaseMonths)
    return { label: $t('{day} 天', { day }), value: item.proxyPurchaseMonths, day, ...item }
  })

  return {
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
  }
}

function createPurchaseMemberConfig(purchaseMember = 1) {
  return {
    title: $t('代理 IP 数量:'),
    name: 'purchaseMember',
    value: purchaseMember,
    fullWidth: true,
    render: ({ item }: any) => (
      <div class="flex items-center gap-4">
        <div class="w-40">
          <RxStepInput
            v-model={item.value}
            min={1}
            max={ONE_BUY_MAX}
            size="md"
            onUpdate:modelValue={(value: number) => {
              nextTick(() => {
                if (!value)
                  item.value = 1
              })
            }}
          />
        </div>
      </div>
    ),
  }
}

async function initConfig() {
  const { data: list } = await API.window.userGetWindowOneClickProxyInfoListList({
    businessId: proxyData.value.businessId,
    proxyProviderId: proxyData.value.proxyProviderId,
  })
  countryList.value = list ?? []

  return [
    createDurationConfig(proxyData.value),
    createPurchaseMemberConfig(),
  ]
}

function onCountryChange(selected: Record<string, any>) {
  if (selected.purchaseCountry.value === proxyData.value.purchaseCountry.value)
    return

  proxyData.value = {
    ...selected,
    description: proxyData.value.description,
  }
  const purchaseMember = configs.value.find(item => item.name === 'purchaseMember')?.value ?? 1
  configs.value = [
    createDurationConfig(selected),
    createPurchaseMemberConfig(purchaseMember),
  ]
}

async function onPay() {
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
    const { purchaseMember, subscriptionMonths, proxyProviderId, purchaseCountry, businessId } = configValue.value
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate({
      entryType,
      purchaseMember,
      subscriptionMonths: subscriptionMonths.value,
      payType,
      orderType: ProxyOrderType.Purchase,
      proxyProviderId,
      purchaseCountry: purchaseCountry.value,
      businessId,
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent'))
      .then(() => {
        void newUserBenefitStore.refreshBenefitIfEligible()
        buySuccess(data)
      })
  }
}

async function buySuccess(orderInfo: any) {
  const { code, data, msg } = await API.proxy.userGetUserBuyProxyListList({ orderNo: orderInfo.orderNo, type: BuyProxyListType.Use } as any)
  onlyErrorToast(code, msg)
  if (code !== 0 || !data.rows?.length)
    return
  emit('success', data.rows[0])
  emit('close')
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-9 py-8 w-256 overflow-hidden">
    <div class="relative flex items-center gap-6 px-8">
      <div class=" tt-primary text-4 font-600 leading-normal">
        {{ $t('还差一步，即可完成！') }}
      </div>
      <SvgIcon class="absolute right-8 top-0 cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="relative flex-1 flex gap-6 overflow-y-auto px-8">
      <RxLoading v-model="loading" :opacity="0.9" />
      <div class="flex-1 flex flex-col gap-9">
        <div class="grid grid-cols-2 gap-y-6">
          <div class="flex flex-col justify-between h-40 col-span-2 rounded-3 pt-4 pb-3 pl-5 info">
            <div class="info-desc">
              {{ proxyData.description }}
            </div>
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-2.5">
                <SvgIcon :name="(`country-code/${configValue.purchaseCountry.countryCode}` as any)" size="32" />
                <div class="tt-primary text-5 font-700 leading-normal">
                  {{ configValue.purchaseCountry.label }}
                </div>
              </div>
              <div class="tt-inactive text-3.5 leading-4">
                {{ $t('静态住宅 IP (独享)') }}
              </div>
            </div>
          </div>
          <div v-if="canSwitchCountry" class="flex flex-col gap-2 col-span-2">
            <div class="tt-primary text-4 font-700 leading-normal">
              {{ $t('选择国家/地区') }}
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <div v-for="item in countryList" :key="item.purchaseCountry.value" class="h-10 relative flex items-center gap-1.5 leading-none px-3 cursor-pointer select-none country-radio"
                   :class="{ active: proxyData.purchaseCountry.value === item.purchaseCountry.value }" @click="onCountryChange(item)"
              >
                <SvgIcon :name="(`country-code/${item.purchaseCountry.value.toLocaleUpperCase()}` as any)" size="20" />
                <div>{{ item.purchaseCountry.label }}</div>
              </div>
            </div>
          </div>
          <div v-for="item in configs" :key="item.name" class="flex flex-col gap-2" :class="[item.fullWidth ? 'col-span-2' : 'col-span-1']">
            <div class="tt-primary text-4 font-700 leading-normal">
              {{ item.title }}
            </div>
            <component :is="item.render" v-if="item.render" :item="item" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <div class="tt-primary text-4 font-700 leading-normal">
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
      <div class="flex flex-col gap-2 w-88">
        <RxAlert v-if="isCN" class="!w-full shrink-0 whitespace-pre-wrap" type="warn" :title="$t('温馨提示')"
                 :content="$t('检测到您当前网络环境位于中国大陆，当前代理 IP 暂不支持直连，请切换至海外网络后使用。\nRoxy 持续助力中国互联网环境健康发展，倡导安全、合规的网络环境。')"
        />
        <RxAlert v-if="isDirect" class="!w-full shrink-0" type="warn" :title="$t('温馨提示')" :content="$t('专为跨境电商深度优化，仅可访问电商网站，限 Roxy 生态内合规使用。Roxy 持续助力中国跨境电商高质量发展，倡导安全、健康的互联网环境。')" />

        <Detail :list="details">
          <template #ipUnitPrice>
            <div class="flex justify-between items-center">
              <div>{{ $t('价格') }}</div>
              <div class="flex gap-2 shrink-0 whitespace-nowrap">
                <span>{{ $t('{month}/个', { month: currency(ipUnitDisplay.price).format() }) }}</span>
                <span v-if="ipUnitDisplay.showOriginal" class="tt-inactive text-3 leading-5 line-through">
                  {{ $t('{month}/个', { month: currency(ipUnitDisplay.original).format() }) }}
                </span>
              </div>
            </div>
          </template>
          <template #price="{ item }">
            <ExclusivePriceRow kind="residential" :offer-active="newUserIpOfferActive" :value="String(item.value ?? '')" :diff-value="item.diffValue" />
          </template>
          <template #after>
            <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
              <RxButton size="lg" :label="$t('立即支付')" @click="onPay" />
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
.period {
  border-radius: 8px;
  border: 3px solid var(--colors-background-bg-page);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  transition: all 0.3s;

  color: var(--colors-text-text-primary);
  font-size: 16px;
  line-height: 24px;

  &.active {
    border-color: var(--colors-border-border-brand);
    background: var(--pattern-pay-gradient-selected-start);
    box-shadow: none;
    color: var(--colors-text-text-brand);
    font-weight: 600;
  }
}
</style>

<style lang="scss" scoped>
.info {
  border: 1px solid var(--colors-border-border-action, #c7d1d6);
  background-image: url('/images/proxy/preorder_bg_line.svg');
  background-size: 100% auto;
  background-position: top left;
  background-repeat: no-repeat;

  &-desc {
    font-family: 'DingTalk JinBuTi';
    font-size: 20px;
    background: linear-gradient(90deg, #1ba9ff 0%, #60d990 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.country-radio {
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
    color: var(--colors-text-text-brand);
    font-weight: 600;
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
