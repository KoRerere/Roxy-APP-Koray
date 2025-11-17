<script setup lang="ts">
import { isLikeFunction } from '/@/utils'
import type { ToggleSwitchProps } from 'primevue/toggleswitch'

interface Props extends /* @vue-ignore */ Omit<ToggleSwitchProps, 'modelValue' | 'disabled' | 'readonly' | 'trueValue' | 'falseValue'> {
  disabled?: boolean
  readonly?: boolean
  trueValue?: any
  falseValue?: any
  beforeChange?: (newValue: any) => boolean | void | Promise<boolean | void>
}

const emit = defineEmits(['value-change', 'change'])

defineOptions({ inheritAttrs: false })

const { disabled = false, readonly = false, trueValue = true, falseValue = false, beforeChange, ...props } = defineProps<Props>()

const modelValue = defineModel<any>()

const loading = ref(false)
const isDisabled = computed(() => disabled || readonly || loading.value)

async function onSwitch() {
  if (isDisabled.value) return

  const newValue = modelValue.value === trueValue ? falseValue : trueValue

  if (isLikeFunction(beforeChange)) {
    loading.value = true
    const isOk = await beforeChange!(newValue)
    loading.value = false
    if (isOk === false) return
  }

  modelValue.value = newValue
  emit('value-change', newValue)
  emit('change', newValue)
}

</script>

<template>
  <div :class="{ 'cursor-pointer': !isDisabled, 'cursor-not-allowed': disabled }" @click="onSwitch">
    <ToggleSwitch class="pointer-events-none" v-bind="{ ...props, ...$attrs, readonly, trueValue, falseValue }" :model-value="modelValue" :disabled="disabled || loading">
      <template v-if="loading" #handle>
        <SvgIcon name="base/rx_ic_spin" class="loading-circle" />
      </template>
    </ToggleSwitch>
  </div>
</template>

<style scoped>
.loading-circle {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
