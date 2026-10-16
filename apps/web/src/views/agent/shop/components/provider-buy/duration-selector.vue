<script setup lang="ts">
import { getOptionGridStyle } from './utils'
import type { DurationOption } from './utils'
import { useProxyPurchaseLabels } from '../../utils/proxy-purchase-labels'

const { options } = defineProps<{
  options: DurationOption[]
}>()

const modelValue = defineModel<DurationOption>()

const styles = useCssModule()
const labels = useProxyPurchaseLabels()

const durationGridStyle = computed(() => getOptionGridStyle(options.length))
</script>

<template>
  <div class="flex gap-2 col-span-2 w-full min-w-0">
    <div class="w-22 h-10 flex items-center tt-primary text-3.5 font-600 leading-normal shrink-0 whitespace-nowrap">
      {{ labels.entityDuration }}
    </div>
    <div class="grid flex-1 min-w-0 justify-start pr-7" :style="durationGridStyle">
      <div v-for="option in options" :key="option.value" class="max-w-38 min-w-0 h-10 flex items-center justify-center leading-none cursor-pointer select-none whitespace-nowrap"
           :class="[styles.period, styles.radio, modelValue?.value === option.value ? styles.active : '']" @click="modelValue = option"
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
</style>
