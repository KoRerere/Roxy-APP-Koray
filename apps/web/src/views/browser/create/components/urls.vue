<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'
import FormItem from '/@/components/ry-form/form-item.vue'
import { $t } from '/@/locales'
import { validateURL } from '/@/utils'

defineOptions({
  inheritAttrs: false,
})

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
const invalid = defineModel('invalid', { default: false })

const urls = ref<Input[]>(modelValue.value.map(value => createItem(value)))

watch(urls.value, (value) => {
  invalid.value = value.some(item => item.invalid)
})

function createItem(value?: string) {
  return {
    type: 'text',
    name: (new Date().getTime()).toString(32),
    value,
    errorMsg: $t('请输入正确的 URL'),
    placeholder: $t('网址前请加 http:// 或 https://'),
    leftIcon: 'base/rx_ic_link' as SvgNames,
  }
}

function addInputs() {
  urls.value.push(createItem())
}

function deleteInput(index: number) {
  urls.value.splice(index, 1)
}

function onChange(input: any) {
  input.invalid = false
}

function onBlur(input: any) {
  if (validateURL(input.value)) {
    modelValue.value = urls.value.filter((item: any) => !item.invalid).map((item: any) => item.value)
  }
  else {
    input.invalid = true
  }
}
</script>

<template>
  <div class="flex-1">
    <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_plus" :label="$t('添加 URL')" @click="addInputs" />
    <RxCard v-for="(input, index) in urls" :key="input.name" class="!border-none !pa-0 mt-2.5" @close="deleteInput(index)">
      <FormItem v-model="input.value" v-bind="input" @blur="onBlur(input)" @change="onChange(input)" />
    </RxCard>
  </div>
</template>

<style lang="scss" scoped></style>
