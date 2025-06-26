<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { RxSvgIcon } from '/@/components/rx-icon/'

interface Props {
  name?: string
  label?: string
  tooltip?: string
  labelWidth?: string
}

defineOptions({
  inheritAttrs: false,
})

defineProps<Props>()

const labelRef = useTemplateRef('label')
const { height, stop } = useElementSize(labelRef)
const lineHeight = ref('32px')

// 兼容俄语，当 label高 度大于 50px 时，自动设置 lineHeight 为 auto
const stopWatch = watch(height, () => {
  if (height.value > 50) {
    lineHeight.value = 'auto'
    stop()
    stopWatch()
  }
})
</script>

<template>
  <label v-if="label" ref="label" class="rx-label" :for="name">
    <span>{{ label }}</span>
    <RxSvgIcon v-if="tooltip" v-tooltip.top="{ value: tooltip, showDelay: 500 }" class="align-middle ml-1" name="base/rx_ic_info" :size="12" color="var(--colors-icon-icon-note)" />
  </label>
</template>

<style lang="scss" scoped>
.rx-label {
  margin-right: 8px;
  min-width: 130px;
  width: v-bind(labelWidth);
  line-height: v-bind(lineHeight);
  color: var(--colors-text-text-primary);
  font-size: 13px;
}
</style>
