<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

defineProps({
  name: String,
  label: String,
  tooltip: String,
  labelWidth: {
    type: String,
  },
})
</script>

<template>
  <label v-if="label" class="rx-label" :for="name">
    <div class="rx-label__content">
      <span>{{ label }}</span>
      <RxSvgIcon v-if="tooltip" v-tooltip.top="{ value: tooltip, showDelay: 500 }" name="base/rx_ic_info" :size="12" color="#C7CDD1" />
    </div>
  </label>
</template>

<style lang="scss" scoped>
.rx-label {
  margin-right: var(--spacing-lg, 8px);
  width: v-bind(labelWidth);
  min-width: 120px;
  color: var(--Component-Colors-TextInput-label-label, #171c1f);
  font-family: Inter;
  font-size: 13px;
  font-weight: 500;
  line-height: var(--Line-Height-display-xs, 32px);

  &__content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 4px);
  }
}
</style>
