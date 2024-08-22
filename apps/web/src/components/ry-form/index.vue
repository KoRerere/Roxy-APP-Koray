<script setup lang="ts">
import inputBase from './input-base.vue'
import inputSelect from './input-select.vue'

defineProps({
  inputs: {
    tyep: Array as PropType<any[]>,
    default: () => [],
  },
  labelPosition: {
    type: String,
    default: 'top',
  },
})

defineEmits(['iconClick'])

const baseInput = ['text', 'password', 'number', 'textarea']
</script>

<template>
  <form class="ry-form" action="">
    <template v-for="input in inputs" :key="input.name">
      <slot :name="input.slot" :input="{ ...input, labelPosition }">
        <div v-if="input.separator" class="ry-form-line" />
        <input-base v-else-if="baseInput.includes(input.type)" v-model="input.value"
          v-bind="{ ...input, labelPosition }" @icon-click="() => $emit('iconClick', input)" />
        <input-select v-else-if="input.type === 'select'" v-bind="{ ...input, labelPosition }" v-model="input.value" />
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
