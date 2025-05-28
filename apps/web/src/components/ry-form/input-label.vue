<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { RxSvgIcon } from '/@/components/rx-icon/'

defineProps({
  name: String,
  label: String,
  tooltip: String,
  labelWidth: {
    type: String,
  },
})

const labelElRef = useTemplateRef('labelEl')
const { height, stop } = useElementSize(labelElRef)
const lineHeight = ref('32px')

const stopWatch = watch(height, () => {
  if (height.value > 50) {
    lineHeight.value = 'auto'
    stop()
    stopWatch()
  }
})
</script>

<template>
  <label v-if="label" ref="labelEl" class="rx-label" :for="name">
    <div class="rx-label__content">
      <div>
        <span>{{ label }}</span>
        <RxSvgIcon v-if="tooltip" v-tooltip.top="{ value: tooltip, showDelay: 500 }" class="align-middle ml-1"
          name="base/rx_ic_info" :size="12" color="var(--colors-icon-icon-note)" />
      </div>
    </div>
  </label>
</template>

<style lang="scss" scoped>
.rx-label {
  margin-right: var(--spacing-lg, 8px);
  width: v-bind(labelWidth);
  min-width: 130px;
  color: var(--colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 13px;
  font-weight: 500;
  line-height: var(--Line-Height-display-xs, v-bind(lineHeight));

  &__content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 4px);
  }
}
</style>
