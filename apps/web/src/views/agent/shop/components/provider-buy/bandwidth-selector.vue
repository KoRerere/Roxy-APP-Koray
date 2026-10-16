<script setup lang="ts">
import { I18nT } from 'vue-i18n'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import { getOptionGridStyle } from './utils'
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

const bandwidthGridStyle = computed(() => getOptionGridStyle(options.length))
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
    <div class="min-w-22 h-10 flex items-center gap-1 tt-primary text-3.5 font-600 leading-normal shrink-0 whitespace-nowrap">
      <span>{{ labels.entityBandwidth }}</span>
      <SvgIcon v-tooltip.top="labels.bandwidthUpgradeTooltip" class="cursor-pointer" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
    </div>
    <div class="grid flex-1 min-w-0 justify-start pr-7" :style="bandwidthGridStyle">
      <div v-for="option in options" :key="option.value" v-tooltip.top="{ value: option.bandwidthSpeedDesc }"
           class="max-w-38 min-w-0 h-10 flex items-center justify-center leading-none cursor-pointer select-none whitespace-nowrap"
           :class="[styles.period, styles.radio, modelValue === option.value ? styles.active : '']" @click="modelValue = option.value"
      >
        {{ option.label }}
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

.bandwidth {
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
