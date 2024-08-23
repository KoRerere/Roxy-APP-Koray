<script setup lang="ts">
import inputBase from './input-base.vue'
import formItem from './form-item.vue'

const _props = defineProps({
  inputs: {
    tyep: Array,
    default: () => [],
  },
  labelPosition: {
    type: String,
    default: 'top',
  },
})

defineEmits(['iconClick'])

const _inputs = computed(() => _props.inputs.filter(input => input.visible !== false))

const baseInput = ['text', 'password', 'number', 'textarea']
</script>

<template>
  <form class="ry-form" action="">
    <template v-for="input in _inputs" :key="input.name">
      <slot :name="input.slot" :input="{ ...input, labelPosition }">
        <div v-if="input.separator" class="ry-form-line" />
        <input-base v-else-if="baseInput.includes(input.type)" v-model="input.value"
          v-bind="{ ...input, labelPosition }" @icon-click="() => $emit('iconClick', input)" />
        <form-item v-else v-bind="input" v-model="input.value" :label-position="labelPosition"
          @change="() => input.change?.(input.value, input, inputs)" />
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
