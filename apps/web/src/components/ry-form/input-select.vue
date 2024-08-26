<script setup>
defineProps({
  name: String,
})
</script>

<template>
  <Select filter show-clear option-label="label" v-bind="$attrs" :input-id="name" class="w-full">
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
</template>

<style lang="scss" scoped>
.select-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
}
</style>
