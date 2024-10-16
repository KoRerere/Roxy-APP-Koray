<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import inputBase from '/@/components/ry-form/input-base.vue'
import { isValidUrl } from '/@/utils'

interface Input {
  type: string
  name: string
  value: string | undefined
  errorMsg: string
  placeholder: string
  leftIcon: string
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
    leftIcon: 'base/rx_ic_attachment',
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
  if (isValidUrl(input.value)) {
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
      <ry-button size="small" severity="secondary" icon="base/rx_ic_plus" label="Add URLs" @click="addInputs" />
      <div class="inputs">
        <rxCard v-for="(input, index) in urlInputs" :key="input.name" class="inputs-item" @close="deleteInput(index)">
          <inputBase v-model="input.value" v-bind="input" @blur="onBlur(input)" @change="onChange(input)" />
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
