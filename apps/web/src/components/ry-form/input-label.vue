<script setup lang="ts">
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
    <span>{{ label }}</span>
    <span v-if="tooltip" v-tooltip.top="tooltip" class="mdi mdi-alert-octagon rx-label-tooltip" />
  </label>
</template>

<style lang="scss" scoped>
.rx-label {
  display: flex;
  gap: var(--spacing-sm, 4px);
  margin-right: var(--spacing-lg, 8px);
  margin-bottom: var(--spacing-sm, 4px);
  width: var(v-bind(labelWidth));
  min-width: 120px;
  color: var(--Component-Colors-TextInput-label-label, #171c1f);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);

  &-tooltip {
    font-size: 12px;
  }
}
</style>
