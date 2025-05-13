<script setup lang="ts">

interface Props {
  label: string
  tooltip?: string
}

defineProps<Props>()

</script>

<template>
  <label>
    <span class="label">{{ label }}</span>
    <SvgIcon v-if="tooltip" v-tooltip.top="{ value: tooltip, showDelay: 300 }" class="ml-1 align-middle" name="base/rx_ic_info" color="var(--colors-icon-icon-note, #AFB7BB)" size="12" />
  </label>
</template>

<style scoped lang="scss">
.label {
  color: var(--colors-text-text-primary, #111213);
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
}
</style>
