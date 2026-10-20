<script setup lang="ts">
import RxImage from '/@/components/rx-image'
import RxTooltip from '/@/components/rx-tooltip'
import TruncateText from './truncate-text.vue'
import { ProxyUseType } from '/@/enums/proxy'
import { useOptionGridStyle } from './utils'
import type { BusinessUseOption } from './utils'
import { useProxyPurchaseLabels } from '../../utils/proxy-purchase-labels'

const { options, modelValue } = defineProps<{
  options: BusinessUseOption[]
  modelValue?: BusinessUseOption
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BusinessUseOption]
}>()

const labels = useProxyPurchaseLabels()

const { stacked, style: optionGridStyle } = useOptionGridStyle()

function isDirectOption(option: BusinessUseOption) {
  return option.badgeType === ProxyUseType.Direct
}

/** 第一项（通用）独占一行；其余普通用途排在后面，带「大陆直连」标签的统一排到最后，并向上补位不单独换行 */
const sortedOptions = computed(() => {
  const [first, ...rest] = options
  if (!first) {
    return []
  }
  return [first, ...rest.filter(option => !isDirectOption(option)), ...rest.filter(isDirectOption)]
})

/** 只有第二项从新的一行开始（让「通用」独占首行），其余按网格顺序向上补位 */
function getItemClass(_option: BusinessUseOption, index: number) {
  return index === 1 ? 'col-start-1' : undefined
}

function select(option: BusinessUseOption) {
  emit('update:modelValue', option)
}

function showBadge(option: BusinessUseOption) {
  return !!option.badgeDesc && !labels.value.hideDirectTag
}

function showSpecialOfferHint(option: BusinessUseOption) {
  return option.isSpecialOffer && !labels.value.hideSpecialOfferHint
}
</script>

<template>
  <div class="flex gap-2 col-span-2" :class="stacked ? 'flex-col' : ''">
    <div class="flex items-center tt-primary text-3.5 font-600 leading-normal shrink-0 whitespace-nowrap" :class="stacked ? '' : 'w-28 h-10'">
      {{ labels.entityUsage }}
    </div>
    <div class="grid flex-1 min-w-0 justify-start gap-y-3 pr-6" :style="optionGridStyle">
      <RxTooltip v-for="(option, index) in sortedOptions" :key="option.value" class="min-w-0" :class="getItemClass(option, index)">
        <div class="flex flex-col items-center gap-0.5 min-w-0 w-full">
          <div class="h-10 w-full px-2 relative flex items-center justify-center gap-1.5 leading-none cursor-pointer select-none" :class="[
            $style.radio,
            modelValue?.value === option.value ? $style.active : '',
          ]" @click="select(option)"
          >
            <div v-if="showBadge(option)" class="absolute position-y-center top-0 -right-2 z-10 px-2 rounded-full" :class="$style[option.badgeClass as keyof typeof $style]">
              {{ option.badgeDesc }}
            </div>
            <RxImage v-if="option.image" class="block w-5 shrink-0" :src="option.image" :dark-src="option.darkImage" :alt="option.label" />
            <TruncateText :class="$style.purpose" :text="option.label" />
          </div>
          <div v-if="showSpecialOfferHint(option)" class="max-w-full truncate color-[#FF7A00] font-[DingTalk_JinBuTi] text-3.25 leading-3.5">
            {{ option.scenePriceDesc }}
          </div>
        </div>
        <template v-if="!!option.desc?.trim()" #content>
          <div class="w-76 color-[var(--component-tooltip-text-secondary)] whitespace-pre-wrap text-3 leading-4">
            {{ option.desc }}
          </div>
        </template>
      </RxTooltip>
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
}

.purpose {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
}

.direct {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}

.curated {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);
}
</style>
