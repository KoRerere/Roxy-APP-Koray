<script setup lang="ts">
import inputBase from './input-base.vue'

defineProps({
  inputs: Array as PropType<any[]>,
  default: () => [],
})
</script>

<template>
  <form class="ry-form" action="">
    <template v-for="input in inputs" :key="input.name">
      <slot :name="input.slot" :input="input">
        <div v-if="input.separator" class="ry-form-line" />
        <input-base v-else v-model="input.value" v-bind="input" />
      </slot>
    </template>
  </form>
</template>

<style lang="scss" scoped>
.ry-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl, 16px);

  &-line {
    width: 100%;
    height: 0.5px;
    background: var(--Colors-Border-border-container, #c7cdd1);
  }
}
</style>
