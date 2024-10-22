<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'
import rxCard from '/@/components/rx-card'
import FormItem from '/@/components/ry-form/form-item.vue'
import { parseUrl } from '/@/utils'

interface Input {
  type: string
  name: string
  value: string | undefined
  errorMsg: string
  placeholder: string
  leftIcon: SvgNames
  invalid?: boolean
}

const modelValue = defineModel({ type: Array as PropType<string[]>, default: [] })
const urlInputs = ref<Input[]>(modelValue.value.map(value => createInput(value)))

function createInput(value?: string) {
  return {
    type: 'text',
    name: (new Date().getTime()).toString(32),
    value,
    errorMsg: 'invalid url',
    placeholder: 'Please enter url',
    leftIcon: 'base/rx_ic_attachment' as SvgNames,
  }
}

function addInputs() {
  urlInputs.value.push(createInput())
}

function deleteInput(index: number) {
  urlInputs.value.splice(index, 1)
}

function onChange(input: any) {
  input.invalid = false
}

function onBlur(input: any) {
  const { protocol, domain } = parseUrl(input.value) || {}

  if (protocol && domain) {
    modelValue.value = urlInputs.value.filter((item: any) => !item.invalid).map((item: any) => item.value)
  }
  else {
    input.invalid = true
  }
}
</script>

<template>
  <div class="flex flex-row">
    <input-label v-bind="$attrs" />
    <div class="flex-1">
      <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_plus" label="Add URLs" @click="addInputs" />
      <div class="inputs">
        <rxCard v-for="(input, index) in urlInputs" :key="input.name" class="inputs-item" @close="deleteInput(index)">
          <FormItem v-model="input.value" v-bind="input" @blur="onBlur(input)" @change="onChange(input)" />
        </rxCard>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.inputs {
  &-item {
    padding: 0;
    border: none;
    margin-top: 10px;
  }
}
</style>
