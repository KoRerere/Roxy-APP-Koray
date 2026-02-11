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

const CID = getCurrentInstance()?.uid

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
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <template v-for="(input, index) in _inputs" :key="`${CID}_${input.name ?? ''}_${index}`">
      <slot :name="input.slot" :input="input" :label-position="labelPosition">
        <div v-if="input.separator" class="w-full flex items-center gap-1.5">
          <SvgIcon v-if="input.separatorIcon" v-bind="input.separatorIcon" class="shrink-0" size="16" />
          <div v-if="input.separatorTitle" class="shrink-0 separator-title">
            {{ input.separatorTitle }}
          </div>
          <div class="flex-1 separator-line" />
        </div>

        <input-base v-else-if="baseInput.includes(input.type)" v-model="input.value" v-bind="input" :label-position="labelPosition" @icon-click="() => input.iconClick?.(input, inputs)"
                    @change="onChange(input, inputs)"
        />
        <form-item v-else v-bind="input" v-model="input.value" :label-position="labelPosition" @change="onChange(input, inputs)" @icon-click="() => input.iconClick?.(input, inputs)" />
      </slot>
    </template>
  </form>
</template>

<style lang="scss" scoped>
.separator-title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
}

.separator-line {
  border-width: 0 0 1px 0;
  border-style: dashed;
  border-color: var(--colors-border-divider-dashed);
}
</style>
