<script setup lang="ts">
defineProps<{
  label: string
  tooltip?: string
}>()
</script>

<template>
  <label>
    <span class="label">{{ label }}</span>
    <SvgIcon v-if="tooltip" v-tooltip.top="{ value: tooltip, showDelay: 300 }" class="ml-1 align-middle" name="base/rx_ic_info" color="var(--colors-icon-icon-note, #AFB7BB)" size="12" />
  </label>
</template>

<style scoped lang="scss">
.label {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}
</style>
