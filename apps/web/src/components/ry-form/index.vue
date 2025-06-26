<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
// @ts-ignore
import formItem from './form-item.vue'
import inputBase from './input-base.vue'

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

const baseInput = ['password']

function onChange(input: any, inputs: any) {
  if (input.invalid)
    input.invalid = false
  input.change?.(input, inputs)
}

function onSubmit(event: any) {
  event.preventDefault()
}
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
    <template v-for="input in _inputs" :key="input.name">
      <slot :name="input.slot" :input="input" :label-position="labelPosition">
        <div v-if="input.separator" class="separator"></div>
        <input-base v-else-if="baseInput.includes(input.type)" v-model="input.value" v-bind="input" :label-position="labelPosition" @icon-click="() => input.iconClick?.(input, inputs)"
          @change="onChange(input, inputs)" />
        <form-item v-else v-bind="input" v-model="input.value" :label-position="labelPosition" @change="onChange(input, inputs)" @icon-click="() => input.iconClick?.(input, inputs)" />
      </slot>
    </template>
  </form>
</template>

<style lang="scss" scoped>
.separator {
  width: 100%;
  border-width: 0 0 1px 0;
  border-style: solid;
  border-color: var(--colors-border-divider-dashed);
}
</style>
