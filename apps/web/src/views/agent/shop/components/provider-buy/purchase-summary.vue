<script setup lang="ts">
import currency from 'currency.js'
import RadioButton from 'primevue/radiobutton'
import { createReusableTemplate } from '@vueuse/core'
import { I18nT } from 'vue-i18n'
import RxLoading from '/@/components/rx-loading.vue'
import RxButton from '/@/components/rx-button'
import RxStepInput from '/@/components/rx-step-input/index.vue'
import RxTooltip from '/@/components/rx-tooltip'
import PurchaseAlerts from './purchase-alerts.vue'
import TruncateText from './truncate-text.vue'
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
  compact = false,
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
  /** 半屏布局：账单横向三栏，钉在左侧底部（设计稿 32217:97786） */
  compact?: boolean
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

/** 半屏账单复用的片段：代理类型列表、支付按钮、用户协议、注意事项 */
const [DefineProxyTypes, ReuseProxyTypes] = createReusableTemplate()
const [DefinePayButton, ReusePayButton] = createReusableTemplate()
const [DefineTerms, ReuseTerms] = createReusableTemplate()
const [DefineNotes, ReuseNotes] = createReusableTemplate()
const [DefineRola, ReuseRola] = createReusableTemplate()

const detailItems = computed(() => details.flatMap(group => group.items ?? []))
/** 半屏账单中间栏：除类型、数量、总价外的明细行（国家、天数、自动续费等） */
const compactInfoItems = computed(() => detailItems.value.filter(item => !['type', 'quantity', 'price'].includes(item.slot)))
const quantityItem = computed(() => detailItems.value.find(item => item.slot === 'quantity'))
const priceItem = computed(() => detailItems.value.find(item => item.slot === 'price'))
const showTypeColumn = computed(() => detailItems.value.some(item => item.slot === 'type'))

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
  <DefineProxyTypes>
    <div class="relative">
      <RxLoading :model-value="loadingProxyType" :opacity="0.1" />
      <div class="flex flex-col gap-2">
        <label v-for="item in proxyTypeOptions" :key="item.id" data-marquee-host class="w-full flex flex-col gap-1 px-3 py-2 select-none cursor-pointer" :class="[styles.radio, compact && styles.compact, proxyTypeValue === item.id ? styles.active : '']" :for="`${CID}_${item.id}`">
          <RadioButton v-model="proxyTypeValue" class="!hidden" :input-id="`${CID}_${item.id}`" :value="item.id" name="proxy-provider-type" />
          <div class="flex items-center gap-1.5 min-w-0">
            <TruncateText class="text-3.5 leading-5" :class="item.proxyType === ProxyIpType.Residential ? 'premium' : (proxyTypeValue === item.id ? styles.activeText : 'tt-secondary')" :text="item.typeName" />
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
        <!-- 动态代理入口固定在代理类型卡片正下方；半屏去掉左右内边距，与卡片外边缘对齐 -->
        <div class="flex items-center gap-1.5 min-w-0" :class="compact ? 'py-2' : 'py-2.5 px-3'">
          <ReuseRola />
        </div>
      </div>
    </div>
  </DefineProxyTypes>
  <DefineRola>
    <div class="flex-1 flex items-center gap-1.5 min-w-0 cursor-pointer select-none" @click="jumpToRola()">
      <span class="tt-secondary font-[DingTalk_JinBuTi] text-3.5 leading-normal shrink-0">{{ $t('动态代理 IP') }}</span>
      <span class="px-2 rounded-full shrink-0" :class="styles.rola">Rola IP</span>
      <SvgIcon class="ml-auto shrink-0" name="base/rx_ic_arrow_top_right" size="14" color="var(--colors-icon-icon-note)" />
    </div>
  </DefineRola>
  <DefinePayButton>
    <div v-if="businessUse?.isSpecialOffer" class="tt-inactive text-3 leading-5 text-center">
      {{ labels.specialOfferNote }}
    </div>
    <RxButton v-tooltip.top="payTooltip" size="lg" :disabled="!canPay" :label="$t('立即支付')" @click="emit('pay')" />
  </DefinePayButton>
  <DefineTerms>
    <I18nT tag="div" class="tt-tertiary text-3 leading-4.5 select-none" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
      <template #terms>
        <a class="terms" :href="officialWebsiteUrl" target="_blank">{{ $t('用户协议') }}</a>
      </template>
    </I18nT>
  </DefineTerms>
  <DefineNotes>
    <ol class="ma-0 pl-4">
      <I18nT v-for="item in notes" :key="item.text" tag="li" class="tt-tertiary text-3.25 leading-6" :keypath="item.text" scope="global">
        <template v-for="(bold, index) in item.bolds" :key="index" #[`bold${index}`]>
          <span class="tt-secondary font-bold">{{ bold }}</span>
        </template>
      </I18nT>
    </ol>
  </DefineNotes>

  <!-- 半屏：横向三栏账单（代理类型 | 明细 | 数量 + 价格 + 支付） -->
  <div v-if="compact" class="mr-6 flex flex-col gap-3 p-3 rounded-1.5" :class="styles.bill">
    <div class="flex items-center gap-2">
      <div class="shrink-0 tt-primary text-3.5 font-600 leading-5">
        {{ labels.entityInfo }}
      </div>
      <div v-if="isDirect && !labels.hideDirectTag" class="shrink-0 px-2 rounded-full" :class="styles.direct">
        {{ $t('大陆直连') }}
      </div>
    </div>
    <!-- 两行网格：第一行三栏内容；第二行右侧两栏放用户协议 -->
    <div class="grid gap-x-5 gap-y-3" :class="showTypeColumn ? 'grid-cols-[minmax(0,1fr)_0_minmax(0,1fr)_0_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_0_minmax(0,1fr)]'">
      <template v-if="showTypeColumn">
        <div class="min-w-0">
          <ReuseProxyTypes />
        </div>
        <!-- 第一条分隔线贯穿两行，并向上延伸到标题行（2rem = 行高 + 行间距） -->
        <div class="row-span-2 -mt-8" :class="styles.divider" />
      </template>
      <div class="min-w-0 flex flex-col gap-3">
        <template v-for="item in compactInfoItems" :key="item.label">
          <div v-if="item.slot === 'autoRenew'" class="flex items-center justify-between gap-2">
            <TruncateText class="tt-secondary text-3.5 leading-5" :text="$t('自动续费')" />
            <RxToggleSwitch v-model="isAuto" :before-change="beforeToggleAutoRenew" />
          </div>
          <div v-else-if="item.slot === 'unitPrice'" class="flex items-center justify-between gap-2 tt-secondary text-3.5 leading-5">
            <TruncateText :text="item.label" />
            <span class="shrink-0 whitespace-nowrap font-[DingTalk_JinBuTi]">
              {{ $t('{month}/个', { month: currency(item.proxyPrice).format() }) }}
            </span>
          </div>
          <div v-else class="flex items-center justify-between gap-2 tt-secondary text-3.5 leading-5" :class="item.class">
            <TruncateText :text="item.label" />
            <div class="shrink-0 text-right whitespace-nowrap">
              {{ item.value }}
            </div>
          </div>
        </template>
      </div>
      <div :class="styles.divider" />
      <div class="min-w-0 flex flex-col justify-between gap-3">
        <div class="flex items-center gap-3">
          <TruncateText class="flex-1 tt-secondary text-3.5 leading-5" :text="quantityItem?.label" />
          <div class="quantity-step flex-1 min-w-0">
            <RxStepInput v-model="purchaseMember" container-class="w-full" size="lg" :min="1" :max="Math.min(Math.max(1, currentInventory), ONE_BUY_MAX)" @update:model-value="inputPurchaseMember" />
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <ExclusivePriceRow v-if="priceItem" :kind="newUserOfferKind ?? 'any'" :offer-active="priceRowOfferActive" :value="String(priceItem.value ?? '')" :diff-value="priceItem.diffValue" />
          <ReusePayButton />
        </div>
      </div>
      <div class="min-w-0 flex items-center justify-end gap-2" :class="showTypeColumn ? 'col-[3/-1]' : 'col-[1/-1]'">
        <ReuseTerms />
        <RxTooltip>
          <SvgIcon class="shrink-0 cursor-pointer" name="base/rx_ic_info" size="16" color="var(--colors-icon-icon-note)" />
          <template #content>
            <div class="w-90 flex flex-col gap-1">
              <div class="tt-primary text-3.5 font-600 leading-normal">
                {{ $t('注意事项:') }}
              </div>
              <ReuseNotes />
            </div>
          </template>
        </RxTooltip>
      </div>
    </div>
  </div>

  <!-- 全屏：右侧竖向账单 -->
  <div v-else class="shrink-0 pt-6 w-95 flex flex-col pr-6 gap-2 overflow-hidden overflow-y-auto summary">
    <PurchaseAlerts :is-c-n="isCN" :is-direct="isDirect" />
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
          <ReuseProxyTypes />
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
            <ReusePayButton />
            <ReuseTerms />
          </div>
        </template>
      </Detail>
      <div class="flex flex-col gap-2 pb-6 notes">
        <div class="tt-primary text-3.5 font-600 leading-normal">
          {{ $t('注意事项:') }}
        </div>
        <ReuseNotes />
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

  /* 半屏：去掉 3px 外圈留白，选中 / 未选中卡片外边缘对齐，与标题、动态代理入口左对齐（设计稿 32217:97786） */
  &.compact {
    border: none;
    padding: 10px 14px;
    box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-base);

    &.active {
      box-shadow: inset 0px 0px 0px 2px var(--colors-border-border-brand);
    }
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

.bill {
  border: 1px solid var(--colors-border-border-action);
  background: var(--pattern-pay-plan-bg-bill);
}

.divider {
  border-left: 1px dashed var(--pattern-pay-plan-border-bill-divider);
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
