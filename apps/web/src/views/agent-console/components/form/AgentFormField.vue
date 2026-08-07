<script setup lang="ts">
interface Props {
  label?: string
}

defineProps<Props>()
</script>

<template>
  <section class="agent-form-field">
    <label v-if="label" class="agent-form-field__label">{{ label }}</label>
    <slot name="label" />
    <slot />
  </section>
</template>

<style lang="scss" scoped>
.agent-form-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.agent-form-field__label {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}
</style>
