<script setup lang="ts">
import RxInputNumber from '/@/components/ry-form/rx-input-number.vue'
import RxButton from '/@/components/rx-button/index.vue'
import { isLikeFunction } from '/@/utils'

defineOptions({
  inheritAttrs: false,
})

interface Props {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  minusProps?: any
  plusProps?: any
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  containerClass?: string
  beforePlus?: (value: number) => Promise<boolean> | boolean
  beforeMinus?: (value: number) => Promise<boolean> | boolean
}

const {
  size = 'sm',
  step = 1,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  disabled = false,
  containerClass,
  beforePlus,
  beforeMinus
} = defineProps<Props>()

const emit = defineEmits<{
  change: [value: number]
  plus: [value: number]
  minus: [value: number]
}>()

const currentValue = defineModel('modelValue', { required: true, default: 0 })

const isMinusDisabled = computed(() => disabled || Number(currentValue.value) <= min)
const isPlusDisabled = computed(() => disabled || Number(currentValue.value) >= max)

async function _onMinus() {
  if (isMinusDisabled.value) return

  if (beforeMinus && isLikeFunction(beforeMinus)) {
    const canProceed = await beforeMinus(Number(currentValue.value))
    if (!canProceed) return
  }

  const newValue = Number(currentValue.value) - step
  if (newValue >= min) {
    currentValue.value = newValue
    emit('change', newValue)
    emit('minus', newValue)
  }
}

async function _onPlus() {
  if (isPlusDisabled.value) return

  if (beforePlus && isLikeFunction(beforePlus)) {
    const canProceed = await beforePlus(Number(currentValue.value))
    if (!canProceed) return
  }

  const newValue = Number(currentValue.value) + step
  if (newValue <= max) {
    currentValue.value = newValue
    emit('change', newValue)
    emit('plus', newValue)
  }
}
</script>

<template>
  <div class="inline-flex step" :class="[containerClass, size]">
    <RxButton class="step-minus" v-bind="minusProps" outlined severity="secondary" :size="size" :disabled="isMinusDisabled" @click="_onMinus">
      <template #icon>
        <SvgIcon name="base/rx_ic_minus"></SvgIcon>
      </template>
    </RxButton>
    <RxInputNumber v-model="currentValue" :disabled="disabled" :min="min" :max="max" :step="step" :size="size" v-bind="$attrs" />
    <RxButton class="step-plus" v-bind="plusProps" outlined severity="secondary" :size="size" :disabled="isPlusDisabled" @click="_onPlus">
      <template #icon>
        <SvgIcon name="base/rx_ic_plus"></SvgIcon>
      </template>
    </RxButton>
  </div>
</template>

<style scoped lang="scss">
.step {
  border: 1px solid var(--colors-border-border-action, #C7CDD1);
  background: var(--colors-background-bg-action, #FFF);

  &.lg {
    border-radius: var(--radius-lg, 8px);
  }

  &.md {
    border-radius: var(--radius-md, 6px);
  }

  &.sm {
    border-radius: var(--radius-md, 6px);
  }

  &.xs {
    border-radius: var(--radius-sm, 4px);
    border-width: 0.5px;
  }

  &.xxs {
    border-radius: var(--radius-sm, 4px);
    border-width: 0.5px;
  }

  :deep(.p-inputtext) {
    border-radius: 0;
    border: 0 !important;
    text-align: center;
  }

  &-minus {
    border: 0 !important;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  &-plus {
    border: 0 !important;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
}
</style>