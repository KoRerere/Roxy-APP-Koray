<script setup lang="tsx">
import SellOutModal from '/@/views/agent/shop/components/sell-out-modal.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
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
import { BuyEntryType, ProxyOrderType } from '/@/enums/proxy'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { createProxyPurchaseCountryCache, useProxyPurchaseApi, useProxyPurchaseForm, useProxyPurchasePricing } from '/@/views/agent/shop/components/provider-buy/useProxyPurchase.ts'

const { data: provider = {}, entryType = BuyEntryType.Normal, toRola } = defineProps<{
  entryType?: BuyEntryType
  data?: Record<string, any>
  toRola: () => void
}>()

const emit = defineEmits(['close', 'success'])

const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const { openProcessing } = usePay()
const { getOfficialWebsite } = useSimpleLocale()
const { info: networkInfo } = storeToRefs(useNetworkStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { check } = usePermission()
const { showFreedomActivityModal } = useFreedomActivity()

const api = useProxyPurchaseApi({ entryType })

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
})

const {
  isDirect,
  isCN,
  currentProxyType,
  finalResult,
  details,
} = useProxyPurchasePricing({
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

const canPay = computed(() => check('Cost_Center_all'))
const payTooltip = computed(() => {
  return !canPay.value
    ? $t('暂无权限。如需开通，请联系团队拥有者，更改当前账号身份为管理者并开通‘费用中心’权限。')
    : undefined
})

onMounted(() => init())

function checkStock() {
  if ((currentProxyType.value.inventory ?? 0) > 0) {
    onPay()
    return
  }
  const sceneId = businessUse.value?.value
  const country = purchaseCountry.value?.country_code?.toLocaleUpperCase()
  if (sceneId == null || !country)
    return

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
          onClose={hideModal}
          onConfirm={onConfirm}
        />
      ),
    },
  })

  async function onConfirm({ payType }: { payType: PayWay }) {
    mixpanelTrack('click_pay_proxy_ip')
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate({
      entryType,
      purchaseMember: purchaseMember.value,
      subscriptionMonths: subscriptionMonths.value?.value,
      payType,
      orderType: ProxyOrderType.Purchase,
      proxyProviderId: proxyTypeValue.value,
      bandwidthSpeed: proxySpeedValue.value,
      purchaseCountry: purchaseCountry.value?.value,
      businessId: businessUse.value?.value,
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
  <div class="relative flex-1 flex gap-6 overflow-hidden">
    <RxLoading v-model="loading" :opacity="0.9" />
    <div class="py-5 flex-1 flex flex-col pl-8 gap-9 overflow-hidden overflow-y-auto">
      <div class="grid grid-cols-2 gap-y-6">
        <BusinessUseSelector :options="businessUseOptions" :model-value="businessUse" @update:model-value="selectBusinessUse" />
        <CountrySelector :options="countryOptions" :model-value="purchaseCountry" :loading="loadingPurchaseCountry" @update:model-value="selectCountry" />
        <DurationSelector v-model="subscriptionMonths" :options="durationOptions" />
      </div>
    </div>
    <PurchaseSummary v-model:purchase-member="purchaseMember" v-model:proxy-type-value="proxyTypeValue" v-model:proxy-speed-value="proxySpeedValue" :is-c-n="isCN" :is-direct="isDirect"
                     :loading-proxy-type="loadingProxyType" :current-inventory="currentProxyType.inventory" :proxy-type-options="proxyTypeOptions" :proxy-speed-options="proxySpeedOptions"
                     :subscription-months="subscriptionMonths" :business-use="businessUse" :details="details" :can-pay="canPay" :pay-tooltip="payTooltip" :official-website-url="getOfficialWebsite('/copyright/user')"
                     :vendor-name="provider.vendorName" @pay="checkStock"
    />
  </div>
</template>
