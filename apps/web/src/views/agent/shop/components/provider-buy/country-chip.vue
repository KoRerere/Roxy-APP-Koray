<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { useProxyPurchaseLabels } from '/@/views/agent/shop/utils/proxy-purchase-labels'
import { NEW_USER_IP_DURATION_DAYS } from '/@/views/campaign/new-user/proxy-pricing'
import type { CountryOption } from './utils'

const { option, active } = defineProps<{
  option: CountryOption
  active: boolean
}>()

const emit = defineEmits<{ select: [option: CountryOption] }>()
const styles = useCssModule()

const labels = useProxyPurchaseLabels()
const newUserBenefitStore = useNewUserBenefitStore()
const { datacenterPriceText, residentialPriceText } = storeToRefs(newUserBenefitStore)

/**
 * 该国是否可售对应代理类型。优先看 proxyTpyeList；旧数据没有 list 时退回单类型字段。
 */
function countrySupportsProxyType(kind: 'datacenter' | 'residential') {
  const list = option.proxyTpyeList
  if (list?.length) {
    return list.includes(kind)
  }
  return option.proxyTpye === kind
}

/**
 * 当前芯片是否套用新人专享价（与 hover 文案、渐变描边共用同一套资格）。
 * 住宅优先：须落在 residentialCountries；机房不限国家。
 * 还须该国 proxyTpyeList 包含对应类型，否则即使有额度也不出活动样式。
 * 电商设备购买不套用。
 */
const hasNewUserBenefit = computed(() => {
  if (labels.value.mode === 'device') {
    return false
  }

  const countryCode = option.country_code || option.value
  return (
    (countrySupportsProxyType('residential')
      && newUserBenefitStore.isNewUserIpOffer('residential', NEW_USER_IP_DURATION_DAYS, countryCode))
    || (countrySupportsProxyType('datacenter')
      && newUserBenefitStore.isNewUserIpOffer('datacenter', NEW_USER_IP_DURATION_DAYS, countryCode))
  )
})

/** 有新人 IP 额度时才出 hover 文案，住宅价优先于机房价，且须该国可售对应类型。 */
const benefitTooltip = computed(() => {
  if (!hasNewUserBenefit.value) {
    return ''
  }

  const countryCode = option.country_code || option.value
  if (
    countrySupportsProxyType('residential')
    && newUserBenefitStore.isNewUserIpOffer('residential', NEW_USER_IP_DURATION_DAYS, countryCode)
  ) {
    return $t('新人活动福利：限时 {price}', { price: residentialPriceText.value })
  }
  return $t('新人活动福利：限时 {price}', { price: datacenterPriceText.value })
})
</script>

<template>
  <div v-tooltip.top="{ value: benefitTooltip, disabled: !benefitTooltip }" class="w-38 h-10 relative flex items-center justify-center gap-1.5 leading-none cursor-pointer select-none" :class="[styles.radio, active && styles.active, hasNewUserBenefit && styles.newUser]" @click="emit('select', option)">
    <div v-if="option.isNew"
         class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white"
    >
      NEW
    </div>
    <div v-if="option.isHot"
         class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white"
    >
      HOT
    </div>
    <RxSvgIcon :name="(option.icon as any)" size="18" />
    <div :class="styles.purpose">
      {{ option.name }}
    </div>
  </div>
</template>

<style lang="scss" module>
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

    .purpose {
      color: var(--colors-text-text-brand);
      font-weight: 600;
    }
  }

  /* 新人专享：用 1px 青→绿渐变环替换灰描边；选中时仍走该环，避免品牌色 3px 把活动边盖掉 */
  &.newUser {
    box-shadow: none;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      /* 外圆角 8px、3px 页面底色边，内环贴齐内容盒 */
      border-radius: 5px;
      padding: 1px;
      background: linear-gradient(87deg, #03c1d9 0%, #57da48 107.49%);
      -webkit-mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
    }

    &.active {
      border-color: var(--colors-background-bg-page);
    }
  }
}

.purpose {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
}
</style>
