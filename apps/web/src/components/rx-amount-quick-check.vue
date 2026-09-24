<script setup lang="ts">
import currency from 'currency.js'
import { useCampaignStore } from '/@/stores/campaign'

const { presets = [50, 100, 500, 1000], disabled = false, min = 0 } = defineProps<{
  presets?: number[]
  disabled?: boolean
  /** 低于该金额的快捷选项禁用 */
  min?: number
}>()

const emit = defineEmits<{
  (e: 'select', value: number): void
}>()

const { seasonalActivity } = storeToRefs(useCampaignStore())
const { getActivityPercentage } = useCampaignStore()

const actualPresets = computed(() => {
  return presets.map((value) => {
    const percentage = getActivityPercentage(value)

    return {
      text: currency(value, { precision: 0 }).format(),
      percentage,
      value,
      disabled: disabled || value < min,
    }
  })
})

function handleSelect(value: number, itemDisabled: boolean) {
  if (itemDisabled) {
    return
  }

  emit('select', value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div v-for="item in actualPresets" :key="item.value" class="relative min-w-25 py-1.5 px-4 text-center rounded-1.5 cursor-pointer select-none preset" :class="{ disabled: item.disabled }"
         @click="handleSelect(item.value, item.disabled)"
    >
      <span class="preset-text">{{ item.text }}</span>
      <div v-if="seasonalActivity.midAutumnFestival && item.percentage" class="absolute -top-0.5 right-1 position-y-center">
        <div class="h-5 px-1.5 flex items-center rounded-full percentage">
          <span class="percentage-text text-3.5 leading-4.5">{{ $t('赠 {percentage}%', { percentage: item.percentage }) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preset {
  border: 0.5px solid var(--colors-border-border-subtle);
  background: var(--colors-background-bg-block);

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:last-of-type) {
    .percentage {
      border: 1px solid var(--colors-border-border-warning);
      background: var(--colors-background-bg-warning);

      &-text {
        color: var(--colors-text-text-warning);
      }
    }
  }

  &-text {
    color: var(--component-tag-text);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
}

.percentage {
  border: 1px solid var(--colors-border-border-error);
  background: var(--colors-background-bg-error);

  &-text {
    color: var(--component-dropdown-text-active);
    font-family: 'DingTalk JinBuTi';
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
