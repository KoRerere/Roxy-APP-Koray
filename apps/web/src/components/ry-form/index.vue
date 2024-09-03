<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import inputBase from './input-base.vue'
// @ts-ignore
import formItem from './form-item.vue'

const _props = defineProps({
  inputs: {
    tyep: Array as PropType<any>,
    default: () => [],
  },
  labelPosition: {
    type: String,
    default: 'top',
  },
})

const _inputs: any = computed(() => _props.inputs.filter((input: any) => input.visible !== false))

const baseInput = ['text', 'password', 'number', 'textarea']
</script>

<template>
  <form class="ry-form" action="">
    <template v-for="input in _inputs" :key="input.name">
      <slot :name="input.slot" :input="input" :label-position="labelPosition">
        <div v-if="input.separator" class="ry-form-line" />

        <input-base v-else-if="baseInput.includes(input.type)" v-model="input.value" v-bind="input"
          :label-position="labelPosition" @icon-click="() => input.iconClick?.(input, inputs)" />

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
