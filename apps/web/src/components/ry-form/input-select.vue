<script setup>
import inputLabel from './input-label.vue'

defineProps({
  name: String,
  labelPosition: {
    type: String,
    default: 'top',
  },
  tooltip: String,
})
</script>

<template>
  <div class="rx-input" :class="{ 'rx-label-left': labelPosition === 'left' }">
    <slot name="label">
      <input-label class="input-label" v-bind="$attrs" :name="name" />
    </slot>
    <Select :input-id="name" filter option-label="label" show-clear class="w-full" v-bind="$attrs">
      <template #value="{ value: option, placeholder }">
        <div v-if="option" class="select-item">
          <span :class="option.icon" />
          <div>{{ option.label }}</div>
        </div>
        <span v-else>
          {{ placeholder }}
        </span>
      </template>
      <template #option="{ option }">
        <div class="select-item">
          <span :class="option.icon" />
          <div>{{ option.label }}</div>
        </div>
      </template>
    </Select>
  </div>
</template>

<style lang="scss" scoped>
.rx-input {
  display: flex;
  flex-direction: column;

  &.rx-label-left {
    flex-direction: row;
  }
}

.select-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
}
</style>
