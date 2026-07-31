<script setup lang="ts">
defineProps<{
  label: string
  tooltip?: string
  required?: boolean
}>()
</script>

<template>
  <label class="inline-flex items-center" :class="{ 'label--required': required }">
    <span class="tt-primary text-3 font-500 leading-5 label">{{ label }}</span>
    <SvgIcon v-if="tooltip" v-tooltip.top="{ value: tooltip, showDelay: 300, pt: { root: '!max-w-70' } }" class="ml-1 align-middle" name="base/rx_ic_info" color="var(--colors-icon-icon-note, #AFB7BB)"
             size="12"
    />
  </label>
</template>

<style scoped lang="scss">
.label--required .label::before {
  margin-right: 2px;
  color: var(--colors-text-text-error);
  content: '*';
}
</style>
