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
  if (itemDisabled)
    return

  emit('select', value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div v-for="item in actualPresets" :key="item.value" class="relative min-w-25 py-1.5 px-4 text-center rounded-1.5 cursor-pointer select-none preset" :class="{ disabled: item.disabled }"
         @click="handleSelect(item.value, item.disabled)"
    >
      <span class="preset-text">{{ item.text }}</span>
      <AnimationBorder v-if="seasonalActivity.juneEighteen && item.percentage" class="absolute -top-0.5 right-1 position-y-center" :gradient="['#05caed', '#05caed', '#47d769']" :animation="false" :deg="110"
                       :border-width="0" :border-radius="4"
      >
        <div class=" h-5 px-1 flex items-center rounded-1 percentage">
          <span class="percentage-text">{{ $t('赠 {percentage}%', { percentage: item.percentage }) }}</span>
        </div>
      </AnimationBorder>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preset {
  border: 0.5px solid var(--component-tag-border);
  background: var(--component-tag-bg);

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:last-of-type) {
    .percentage {
      background: #fc9d12;
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
  background: #fc2d12;

  &-text {
    font-family: 'DingTalk JinBuTi';
    font-size: 11px;
    line-height: 1;
    color: #ffffff;
  }
}
</style>
