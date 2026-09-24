<script setup lang="tsx">
import SellOutModal from '/@/views/agent/shop/components/sell-out-modal.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import ActivityInfoProxy from '/@/views/campaign/mid-autumn-festival/activity-info-proxy.vue'
import BusinessUseSelector from '/@/views/agent/shop/components/provider-buy/business-use-selector.vue'
import CountrySelector from '/@/views/agent/shop/components/provider-buy/country-selector.vue'
import DurationSelector from '/@/views/agent/shop/components/provider-buy/duration-selector.vue'
import PurchaseSummary from '/@/views/agent/shop/components/provider-buy/purchase-summary.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
import { useNetworkStore } from '/@/stores/network'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { usePay } from '/@/views/pay/wallet/hook'
import { PayWay } from '/@/enums/pay'
import type { ProxyIpType } from '/@/enums/proxy'
import { BuyEntryType, ProxyOrderType } from '/@/enums/proxy'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { useMidAutumnActivity } from '/@/views/campaign/mid-autumn-festival/hook.ts'
import { createProxyPurchaseCountryCache, useProxyPurchaseApi, useProxyPurchaseForm, useProxyPurchasePricing } from '/@/views/agent/shop/components/provider-buy/useProxyPurchase.ts'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import type { CountryOption } from '/@/views/agent/shop/components/provider-buy/utils'
import { useRouteContext } from '/@/composables/useRouteContext'
import { useProxyPurchaseLabels } from '/@/views/agent/shop/utils/proxy-purchase-labels'
import type { ProxyPurchaseMode } from '/@/views/agent/shop/utils/proxy-purchase-labels'
import type { WorkspaceType } from '/@/enums/base'

const {
  data: provider = {},
  entryType = BuyEntryType.Normal,
  mode,
  toRola,
  cancelRedirect = true,
  workspaceType,
  preferredProxyType,
  preferredCountry,
} = defineProps<{
  entryType?: BuyEntryType
  data?: Record<string, any>
  mode?: ProxyPurchaseMode
  toRola?: () => void
  /** 取消支付时是否跳转到钱包账单页，默认 true */
  cancelRedirect?: boolean
  /** 工作区类型；before-enter 需显式传入（此时工作区可能尚未切到电商） */
  workspaceType?: WorkspaceType
  /** 新人福利等入口指定默认代理类型（机房 / 住宅） */
  preferredProxyType?: ProxyIpType | 'datacenter' | 'residential'
  /** 检测失败引导购买：仅初始化「国家/地区」时匹配一次 */
  preferredCountry?: string
}>()

const emit = defineEmits<{
  close: []
  success: [data: unknown]
  countryChange: [country: CountryOption | undefined]
}>()

const { isEcommerce, workspaceType: routeWorkspaceType } = useRouteContext()

/** 显式 props 优先；共享页未传时按当前工作区推断（电商=设备 / 通用=代理） */
const resolvedMode = computed<ProxyPurchaseMode>(() =>
  mode ?? (isEcommerce.value ? 'device' : 'proxy'),
)

/** before-enter 可显式传入；电商共享入口用当前工作区类型拉场景列表 */
const resolvedWorkspaceType = computed(() =>
  workspaceType ?? (isEcommerce.value ? routeWorkspaceType.value : undefined),
)

const labels = useProxyPurchaseLabels(resolvedMode)
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing, maybeShowFirstConsumeReferralPopup } = usePay()
const { getOfficialWebsite } = useSimpleLocale()
const { info: networkInfo } = storeToRefs(useNetworkStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { check } = usePermission()
const { showFreedomActivityModal } = useFreedomActivity()
const { showLuckyDrawAfterPay } = useMidAutumnActivity()

const api = useProxyPurchaseApi({ entryType, mode: resolvedMode, workspaceType: resolvedWorkspaceType })

const countryCache = createProxyPurchaseCountryCache({
  fetchCountryList: sceneId => api.getPurchaseCountryListByScene(sceneId),
  vendorId: () => provider.id,
})

const {
  loading,
  loadingProxyType,
  loadingPurchaseCountry,
  purchaseMember,
  businessUseOptions,
  businessUse,
  countryOptions,
  purchaseCountry,
  durationOptions,
  subscriptionMonths,
  proxyTypeOptions,
  proxyTypeValue,
  proxySpeedOptions,
  proxySpeedValue,
  init,
  selectBusinessUse,
  selectCountry,
} = useProxyPurchaseForm({
  vendorId: provider.id,
  getBusinessUseList: api.getBusinessUseList,
  getProxyTypeList: api.getProxyTypeList,
  countryCache,
  preferredProxyType: () => preferredProxyType,
  preferredCountry: () => preferredCountry,
})

const {
  isDirect,
  isCN,
  currentProxyType,
  finalResult,
  details,
} = useProxyPurchasePricing({
  labels,
  userPayInfo,
  businessUse,
  purchaseCountry,
  subscriptionMonths,
  proxyTypeOptions,
  proxyTypeValue,
  proxySpeedOptions,
  proxySpeedValue,
  purchaseMember,
  networkCountryCode: computed(() => networkInfo.value?.country_code),
})

/** 购买结算时一并提交；默认关闭，需用户确认后才会变为开启 */
const isAuto = ref(false)

const canPay = computed(() => check('Cost_Center_all'))
const payTooltip = computed(() => {
  return !canPay.value
    ? $t('暂无权限。如需开通，请联系团队拥有者，更改当前账号身份为管理者并开通‘充值/账单’权限。')
    : undefined
})

onMounted(() => init())

watch(purchaseCountry, (value) => {
  emit('countryChange', value)
}, { immediate: true })

function checkStock() {
  if ((currentProxyType.value.inventory ?? 0) > 0) {
    onPay()
    return
  }
  const sceneId = businessUse.value?.value
  const country = purchaseCountry.value?.country_code?.toLocaleUpperCase()
  if (sceneId == null || !country) {
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <SellOutModal
          proxyProviderId={provider.id}
          sceneId={sceneId}
          country={country}
          onClose={hideModal}
          onJump={toRola}
        />
      ),
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
          cancelRedirect={cancelRedirect}
          onClose={hideModal}
          onConfirm={onConfirm}
        />
      ),
    },
  })

  async function onConfirm({ payType }: { payType: PayWay }) {
    mixpanelTrack('click_pay_proxy_ip')
    const payload = {
      entryType,
      purchaseMember: purchaseMember.value,
      subscriptionMonths: subscriptionMonths.value?.value,
      payType,
      orderType: ProxyOrderType.Purchase,
      proxyProviderId: proxyTypeValue.value,
      bandwidthSpeed: proxySpeedValue.value,
      purchaseCountry: purchaseCountry.value?.value,
      businessId: businessUse.value?.value,
      workspaceType,
      isAuto: isAuto.value,
    }
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate(payload)
    onlyErrorToast(code, msg)
    if (code !== 0) {
      return
    }
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent', { cancelRedirect }))
      .then(async () => {
        // 买完后刷新新人资格，供活动弹窗把已用档位改灰；无资格则不打接口
        await useNewUserBenefitStore().refreshBenefitIfEligible()
        emit('success', data)
        emit('close')
        maybeShowFirstConsumeReferralPopup((reason) => {
          // 查看详情会自己跳推广页，只跳过后续默认动作；抽奖次数已到账，仍要弹出抽奖盘
          showLuckyDrawAfterPay()
          if (reason === 'view-details') {
            return
          }
          showFreedomActivityModal()
        })
      })
  }
}
</script>

<template>
  <div class="relative flex-1 flex gap-5 overflow-hidden">
    <RxLoading v-model="loading" :opacity="0.9" />
    <div class="py-5 flex-1 flex flex-col pl-8 gap-9 rounded-3 overflow-hidden overflow-y-auto selectors">
      <div class="grid grid-cols-2 gap-y-6">
        <ActivityInfoProxy class="mr-6 col-span-2" type="proxy" />
        <BusinessUseSelector :options="businessUseOptions" :model-value="businessUse" @update:model-value="selectBusinessUse" />
        <CountrySelector :options="countryOptions" :model-value="purchaseCountry" :loading="loadingPurchaseCountry" @update:model-value="selectCountry" />
        <DurationSelector v-model="subscriptionMonths" :options="durationOptions" />
      </div>
    </div>
    <PurchaseSummary v-model:purchase-member="purchaseMember" v-model:proxy-type-value="proxyTypeValue" v-model:proxy-speed-value="proxySpeedValue" v-model:is-auto="isAuto" :is-c-n="isCN"
                     :is-direct="isDirect" :loading-proxy-type="loadingProxyType" :current-inventory="currentProxyType.inventory" :proxy-type-options="proxyTypeOptions"
                     :proxy-speed-options="proxySpeedOptions" :subscription-months="subscriptionMonths" :business-use="businessUse" :details="details" :can-pay="canPay" :pay-tooltip="payTooltip"
                     :official-website-url="getOfficialWebsite('/copyright/user')" :country-code="purchaseCountry?.value" :vendor-name="provider.vendorName" @pay="checkStock"
    />
  </div>
</template>

<style lang="scss" scoped>
.selectors {
  background: var(--colors-background-bg-page);
}
</style>
