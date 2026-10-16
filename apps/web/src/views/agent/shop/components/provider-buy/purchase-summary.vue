<script setup lang="ts">
import currency from 'currency.js'
import RadioButton from 'primevue/radiobutton'
import { I18nT } from 'vue-i18n'
import RxLoading from '/@/components/rx-loading.vue'
import RxButton from '/@/components/rx-button'
import RxStepInput from '/@/components/rx-step-input/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import { ProxyIpType } from '/@/enums/proxy'
import { getProxyTypePriceForSelectedDuration } from './utils'
import type { BusinessUseOption, DurationOption, ProxyTypeOption } from './utils'
import { useProxyPurchaseLabels } from '../../utils/proxy-purchase-labels'
import ExclusivePriceRow from '/@/views/campaign/new-user/exclusive-price-row.vue'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { useConfirmAutoRenew } from '/@/views/pay/wallet/components/useConfirmAutoRenew'
import { useRolaJump } from '/@/views/agent/shop/hooks/useRolaJump'

const {
  isCN,
  isDirect,
  loadingProxyType,
  currentInventory,
  proxyTypeOptions,
  subscriptionMonths,
  businessUse,
  details,
  canPay,
  payTooltip,
  officialWebsiteUrl,
  countryCode,
  // vendorName = '',
} = defineProps<{
  isCN: boolean
  isDirect: boolean
  loadingProxyType: boolean
  currentInventory: number
  proxyTypeOptions: ProxyTypeOption[]
  subscriptionMonths?: DurationOption
  businessUse?: BusinessUseOption
  details: any[]
  canPay: boolean
  payTooltip?: string
  officialWebsiteUrl: string
  /** 当前选中国家码，静态住宅用它对照福利白名单 */
  countryCode?: string
  // vendorName?: string
}>()

const emit = defineEmits<{
  pay: []
}>()

const labels = useProxyPurchaseLabels()
const newUserBenefitStore = useNewUserBenefitStore()

const ONE_BUY_MAX = 1000

const purchaseMember = defineModel<number>('purchaseMember', { required: true })
const proxyTypeValue = defineModel<number | undefined>('proxyTypeValue')
/** 购买时是否同时开启自动续费，开启前需弹窗确认 */
const isAuto = defineModel<boolean>('isAuto', { default: false })
const { beforeToggleAutoRenew } = useConfirmAutoRenew()
const { jumpToRola } = useRolaJump()

const styles = useCssModule()
const CID = `${getCurrentInstance()?.uid ?? ''}-ptype`

function getUnitPrice(proxyType: ProxyTypeOption) {
  return getProxyTypePriceForSelectedDuration(proxyType, subscriptionMonths?.value)
}

function inputPurchaseMember(value: number) {
  nextTick(() => {
    if (!value) {
      purchaseMember.value = 1
    }
  })
}

const notes = computed(() => labels.value.notes)

/** 按当前选中代理类型决定是否展示新人专享价签 */
const newUserOfferKind = computed(() => {
  const current = proxyTypeOptions.find(item => item.id === proxyTypeValue.value)
  if (current?.proxyType === ProxyIpType.Residential) {
    return 'residential' as const
  }
  if (current?.proxyType === ProxyIpType.Datacenter) {
    return 'datacenter' as const
  }
  return undefined
})

/** 选中类型 + 30 天且仍有额度；电商设备购买不展示 */
const priceRowOfferActive = computed(() => {
  if (labels.value.mode === 'device') {
    return false
  }
  const kind = newUserOfferKind.value
  if (!kind) {
    return false
  }
  return newUserBenefitStore.isNewUserIpOffer(kind, subscriptionMonths?.day ?? 0, countryCode)
})

/** 有福利且买 2 条以上：列表只展示原价，并提示首条新人价 */
const showFirstIpHint = computed(() => priceRowOfferActive.value && purchaseMember.value >= 2)

/** 类型列表上展示的现价 / 是否划线原价 */
function listUnitDisplay(item: ProxyTypeOption) {
  const unit = getUnitPrice(item)
  if (!unit) {
    return undefined
  }

  const kind = item.proxyType === ProxyIpType.Residential
    ? 'residential' as const
    : item.proxyType === ProxyIpType.Datacenter
      ? 'datacenter' as const
      : undefined
  const offer = kind && labels.value.mode !== 'device'
    ? newUserBenefitStore.isNewUserIpOffer(kind, subscriptionMonths?.day ?? 0, countryCode)
    : false
  const catalogOriginal = unit.originalProxyPrice || unit.proxyPrice

  if (!offer) {
    return {
      price: unit.proxyPrice,
      original: unit.originalProxyPrice,
      showOriginal: unit.proxyPrice < unit.originalProxyPrice,
    }
  }

  if (purchaseMember.value >= 2) {
    return { price: catalogOriginal, original: catalogOriginal, showOriginal: false }
  }

  const newPrice = newUserBenefitStore.newUserIpUnitPrice(kind!)
  return {
    price: newPrice,
    original: catalogOriginal,
    showOriginal: newPrice < catalogOriginal,
  }
}
</script>

<template>
  <div class="shrink-0 pt-5 w-95 flex flex-col pr-8 gap-2 overflow-hidden overflow-y-auto summary">
    <RxAlert v-if="isCN" class="!w-full shrink-0 whitespace-pre-wrap" type="warn" :content="labels.cnNetworkAlert" />
    <RxAlert v-if="isDirect && labels.mode === 'proxy'" class="!w-full shrink-0" type="warn" :content="$t('专为跨境电商深度优化，仅可访问电商网站，限 Roxy 生态内合规使用。Roxy 持续助力中国跨境电商高质量发展，倡导安全、健康的互联网环境。')" />
    <RxAlert v-if="isDirect && labels.mode === 'device'" class="!w-full shrink-0" type="warn" :content="$t('设备限 Roxy 生态内合规使用。Roxy 持续助力跨境电商高质量发展，倡导安全、健康的互联网环境。')" />
    <div class="flex flex-col gap-2">
      <Detail :list="details">
        <template #title="props">
          <div class="flex items-center gap-2">
            <div v-bind="props">
              {{ labels.entityInfo }}
            </div>
            <div v-if="isDirect && !labels.hideDirectTag" class="px-2 rounded-full" :class="styles.direct">
              {{ $t('大陆直连') }}
            </div>
          </div>
        </template>
        <template #type>
          <div class="relative">
            <RxLoading :model-value="loadingProxyType" :opacity="0.1" />
            <div class="flex flex-col gap-2">
              <label v-for="item in proxyTypeOptions" :key="item.id" class="w-full flex flex-col gap-1 px-3 py-2 select-none cursor-pointer" :class="[styles.radio, proxyTypeValue === item.id ? styles.active : '']" :for="`${CID}_${item.id}`">
                <RadioButton v-model="proxyTypeValue" class="!hidden" :input-id="`${CID}_${item.id}`" :value="item.id" name="proxy-provider-type" />
                <div class="flex items-center gap-1.5 min-w-0">
                  <div class="text-3.5 leading-5 truncate" :class="item.proxyType === ProxyIpType.Residential ? 'premium' : (proxyTypeValue === item.id ? styles.activeText : 'tt-secondary')">
                    {{ item.typeName }}
                  </div>
                  <SvgIcon v-if="item.desc" v-tooltip.top="item.desc" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
                </div>
                <div v-if="listUnitDisplay(item)" class="flex gap-1.5 shrink-0 whitespace-nowrap">
                  <span class="text-3.25 font-[DingTalk_JinBuTi] leading-4.5" :class="proxyTypeValue === item.id ? styles.activeText : 'tt-secondary'">
                    {{ $t('{month}/个', { month: currency(listUnitDisplay(item)!.price).format() }) }}
                  </span>
                  <span v-if="listUnitDisplay(item)!.showOriginal" class="tt-tertiary text-3 leading-4.5 line-through">
                    {{ $t('{month}/个', { month: currency(listUnitDisplay(item)!.original).format() }) }}
                  </span>
                </div>
              </label>
              <div v-if="showFirstIpHint && newUserOfferKind" class="tt-tertiary text-3 leading-4.5">
                {{ $t('首条 IP 享受 {price} 新用户价，不与其他折扣叠加', { price: currency(newUserBenefitStore.newUserIpUnitPrice(newUserOfferKind)).format() }) }}
              </div>
              <div class="flex items-center py-2.5 px-3 gap-1.5 min-w-0 cursor-pointer select-none" @click="jumpToRola()">
                <span class="tt-secondary font-[DingTalk_JinBuTi] text-3.5 leading-normal shrink-0">{{ $t('动态代理 IP') }}</span>
                <span class="px-2 rounded-full shrink-0" :class="styles.rola">Rola IP</span>
                <SvgIcon class="ml-auto shrink-0" name="base/rx_ic_arrow_top_right" size="14" color="var(--colors-icon-icon-note)" />
              </div>
            </div>
          </div>
        </template>
        <template #quantity="{ item, classes }">
          <div class="flex items-center justify-between gap-2">
            <div :class="classes">
              {{ item.label }}
            </div>
            <div class="quantity-step shrink-0">
              <RxStepInput v-model="purchaseMember" container-class="w-32" size="lg" :min="1" :max="Math.min(Math.max(1, currentInventory), ONE_BUY_MAX)" @update:model-value="inputPurchaseMember" />
            </div>
          </div>
        </template>
        <template #unitPrice="{ item, classes }">
          <div class="flex justify-between items-center">
            <div :class="classes">
              {{ item.label }}
            </div>
            <div class="flex gap-2 shrink-0 whitespace-nowrap">
              <span class="font-[DingTalk_JinBuTi]" :class="classes">
                {{ $t('{month}/个', { month: currency(item.proxyPrice).format() }) }}
              </span>
              <!-- <span v-if="item.proxyPrice < item.originalProxyPrice" class="tt-inactive text-3 leading-5 line-through">
                {{ $t('{month}/个', { month: currency(item.originalProxyPrice).format() }) }}
              </span> -->
            </div>
          </div>
        </template>
        <template #autoRenew="{ classes }">
          <div class="flex items-center justify-between">
            <div :class="classes">
              {{ $t('自动续费') }}
            </div>
            <RxToggleSwitch v-model="isAuto" :before-change="beforeToggleAutoRenew" />
          </div>
        </template>
        <template #price="{ item }">
          <ExclusivePriceRow :kind="newUserOfferKind ?? 'any'" :offer-active="priceRowOfferActive" :value="String(item.value ?? '')" :diff-value="item.diffValue" />
        </template>
        <template #after>
          <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
            <div v-if="businessUse?.isSpecialOffer" class="tt-inactive text-3 leading-5 text-center">
              {{ labels.specialOfferNote }}
            </div>
            <RxButton v-tooltip.top="payTooltip" size="lg" :disabled="!canPay" :label="$t('立即支付')" @click="emit('pay')" />
            <I18nT tag="div" class="tt-tertiary text-3 leading-4.5 select-none" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
              <template #terms>
                <a class="terms" :href="officialWebsiteUrl" target="_blank">{{ $t('用户协议') }}</a>
              </template>
            </I18nT>
          </div>
        </template>
      </Detail>
      <div class="flex flex-col gap-2 pb-5 notes">
        <div class="tt-primary text-3.5 font-600 leading-normal">
          {{ $t('注意事项:') }}
        </div>
        <ol class="ma-0 pl-4">
          <I18nT v-for="item in notes" :key="item.text" tag="li" class="tt-tertiary text-3.25 leading-6" :keypath="item.text" scope="global">
            <template v-for="(bold, index) in item.bolds" :key="index" #[`bold${index}`]>
              <span class="tt-secondary font-bold">{{ bold }}</span>
            </template>
          </I18nT>
        </ol>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.radio {
  border-radius: 8px;
  border: 3px solid transparent;
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  transition: all 0.3s;

  &:not(.active):hover {
    background: var(--colors-background-bg-action-hover);
  }

  &.active {
    border-color: var(--colors-border-border-brand);
    // background: var(--pattern-pay-gradient-selected-start);
    box-shadow: none;
  }
}

// .activeText {
//   color: var(--colors-text-text-brand);
// }

.direct {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}

.rola {
  color: var(--component-dropdown-text-active);
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #1eed58 0%, #11a3fd 137.63%);
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

.quantity-step {
  :deep(.step) {
    border: 1px solid var(--colors-border-border-action, #c7d1d6);
    background: var(--colors-background-bg-action, #fff);
  }

  :deep(.p-inputnumber) {
    flex: 1;
    min-width: 0;
    width: auto;
  }

  :deep(.p-inputtext) {
    box-shadow: none;

    &:focus,
    &:hover {
      border-radius: 4px;
      background: var(--colors-background-bg-action-hover);
    }
  }

  :deep(.p-button) {
    flex: none;
    box-shadow: none;

    &:disabled {
      background: transparent;
      opacity: 0.8;
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
  color: var(--colors-text-text-brand);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: none;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>
