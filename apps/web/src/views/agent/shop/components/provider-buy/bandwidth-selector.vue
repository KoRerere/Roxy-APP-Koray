<script setup lang="ts">
import { I18nT } from 'vue-i18n'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import { useSimpleLocale } from '/@/stores/locale'
import TruncateText from './truncate-text.vue'
import { useOptionGridStyle } from './utils'
import type { BandwidthOption } from './utils'
import { useProxyPurchaseLabels } from '../../utils/proxy-purchase-labels'

const { options, isDirect } = defineProps<{
  options: BandwidthOption[]
  /** 电商直连不提供档位，只展示默认带宽 */
  isDirect: boolean
}>()

const modelValue = defineModel<number | undefined>()

const styles = useCssModule()
const labels = useProxyPurchaseLabels()

const { compact, style: bandwidthGridStyle } = useOptionGridStyle()

/** 带宽档位卖点标签（设计稿 32220:124648）：文案用后端返回的 bandwidthSpeedDesc，颜色按带宽数值区分 */
const BADGE_CLASS_BY_SPEED: Record<number, string | undefined> = {
  20: styles.badgeGreen,
  50: styles.badgePurple,
  100: styles.badgeOrange,
}

/** 基础档位（10Mbps）不显示标签 */
const NO_BADGE_SPEEDS = [10]

/** 英文下后端文案太长会挤出按钮，改用设计稿里的简写 */
const EN_SHORT_LABEL_BY_SPEED: Record<number, string | undefined> = {
  20: 'Multi-Account',
  50: 'Live Ready',
  100: 'Ultra-Fast',
}
const { siteLocale } = storeToRefs(useSimpleLocale())

function getSpeedBadge(option: BandwidthOption) {
  const label = option.bandwidthSpeedDesc?.trim()
  if (!label || NO_BADGE_SPEEDS.includes(option.bandwidthSpeed)) {
    return undefined
  }
  const shortLabel = siteLocale.value === 'en' ? EN_SHORT_LABEL_BY_SPEED[option.bandwidthSpeed] : undefined
  return { label: shortLabel ?? label, class: BADGE_CLASS_BY_SPEED[option.bandwidthSpeed] ?? styles.badgePurple }
}
</script>

<template>
  <div v-if="isDirect" class="min-h-10 flex items-center">
    <I18nT tag="div" class="tt-secondary font-[DingTalk_JinBuTi] text-3.5 leading-4 select-none" :keypath="$t('电商直连 IP 默认支持 {value}', { value: '{value}' })" scope="global">
      <template #value>
        <span :class="styles.bandwidth">100Mbps</span>
      </template>
    </I18nT>
  </div>
  <div v-else class="flex gap-2 w-full min-w-0">
    <div class="w-28 h-10 flex items-center gap-1 tt-primary text-3.5 font-600 leading-normal shrink-0 whitespace-nowrap">
      <span>{{ labels.entityBandwidth }}</span>
      <SvgIcon v-tooltip.top="labels.bandwidthUpgradeTooltip" class="cursor-pointer" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
    </div>
    <div class="grid flex-1 min-w-0 justify-start pr-6" :style="bandwidthGridStyle">
      <div v-for="option in options" :key="option.value"
           class="relative min-w-0 h-10 px-2 flex items-center justify-center leading-none cursor-pointer select-none whitespace-nowrap"
           :class="[compact ? '' : 'max-w-38', styles.period, styles.radio, modelValue === option.value ? styles.active : '']" @click="modelValue = option.value"
      >
        <TruncateText :text="option.label" />
        <div v-if="getSpeedBadge(option)" class="pointer-events-none absolute -top-2.5 right-1 z-10 px-2 py-0.5 rounded-full" :class="[styles.badge, getSpeedBadge(option)!.class]">
          {{ getSpeedBadge(option)!.label }}
        </div>
      </div>
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

    &.period {
      color: var(--colors-text-text-brand);
      font-weight: 600;
    }
  }
}

.period {
  color: var(--colors-text-text-primary);
  font-size: 16px;
}

.badge {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
  white-space: nowrap;
}

.badgeGreen {
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}

.badgePurple {
  background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);
}

.badgeOrange {
  background: linear-gradient(90deg, #ff4500 0%, #ff8f28 100%);
}

.bandwidth {
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
