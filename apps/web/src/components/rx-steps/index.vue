<script setup lang="ts">
import type { PropType } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'

const props = defineProps({
  steps: {
    type: Array as PropType<{
      key: string
      label?: string
      title?: string
      icon?: string
    }[]>,
    required: true,
  },
})

const modelValue = defineModel()

const isBefore = (key: string) => {
  return props.steps.findIndex(item => item.key === key) < props.steps.findIndex(item => item.key === modelValue.value)
}

const isCurrent = (key: string) => modelValue.value === key;

defineExpose({
  next() {
    const currentIndex = props.steps.findIndex(item => item.key === modelValue.value)
    if (currentIndex < props.steps.length - 1) {
      modelValue.value = props.steps[currentIndex + 1].key
    }
  },
  prev() {
    const currentIndex = props.steps.findIndex(item => item.key === modelValue.value)
    if (currentIndex > 0) {
      modelValue.value = props.steps[currentIndex - 1].key
    }
  }
})

</script>

<template>
  <div class="flex items-center" v-bind="$attrs">
    <div v-for="(setp, index) in steps" class="flex items-center rx-setp-item">
      <div
        :class="['size-24px text-12px rounded-4px font-[Inter] flex items-center justify-center font-600 bg-[var(--component-tag-bg)]', isBefore(setp.key) || isCurrent(setp.key) ? 'rx-setp-active' : '']">
        <template v-if="isBefore(setp.key)">
          <RxSvgIcon name="base/rx_ic_check" color="#12A3FC" size="12" />
        </template>
        <template v-else>
          {{ index + 1 }}
        </template>
      </div>

      <div v-if="index !== steps.length - 1" class="rx-setp-line flex-1"></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rx-setp-active {
  background: var(--component-alert-bg-info, #C8EBFE);
  color: var(--colors-text-text-brand, #11A3FD);
}

.rx-setp-item:not(:last-child) {
  flex: 1;
}

.rx-setp-item:not(:first-child) {
  padding-left: 20px;
}

.rx-setp-item:not(:last-child) .rx-setp-line {
  margin-left: 20px;
}

.rx-setp-line {
  border-bottom: 1px dashed var(--colors-border-divider-dashed);
}
</style>
