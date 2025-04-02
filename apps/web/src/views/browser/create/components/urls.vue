<script setup lang="ts">
import FormItem from '/@/components/ry-form/form-item.vue'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { validateURL } from '/@/utils'

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<string[]>({ default: [] })
const invalid = defineModel('invalid', { default: false })

const platformOptions = ref()
const urls = ref<Record<string, any>[]>([])

watch(modelValue, (value) => {
  urls.value = value.map(value => createItem(value))
})

onBeforeMount(async () => {
  await getPlatformOptions()
  urls.value = modelValue.value.map(value => createItem(value))
})

async function getPlatformOptions() {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})

  platformOptions.value = rows.map(item => ({
    image: item.platformIcon,
    label: item.platformUrl,
    value: item.platformUrl,
  }))
}

function createItem(value?: string) {
  return {
    value,
    props: {
      type: 'select',
      name: (new Date().getTime()).toString(32),
      options: platformOptions.value,
      optionValue: 'value',
      editable: true,
      placeholder: $t('网址前请加 http:// 或 https://'),
      errorMsg: $t('请输入正确的 URL'),
    }
  }
}

function addInputs() {
  urls.value.push(createItem())
}

function deleteInput(index: number) {
  urls.value.splice(index, 1)
  updateUrls()
}

function onChange(input: any) {
  input.invalid = false
}

function onBlur(input: any) {
  if (validateURL(input.value)) {
    updateUrls()
  }
  else {
    input.invalid = true
    invalid.value = true
  }
}

function updateUrls() {
  modelValue.value = urls.value.filter(item => !item.invalid).map(item => item.value)
  nextTick(() => {
    invalid.value = urls.value.some(item => item.invalid)
  })
}
</script>

<template>
  <div class="flex-1">
    <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_plus" :label="$t('添加 URL')" @click="addInputs" />
    <RxCard v-for="(input, index) in urls" :key="input.name" class="!border-none !pa-0 mt-2.5" @close="deleteInput(index)">
      <FormItem v-model="input.value" v-bind="input.props" :invalid="input.invalid" @blur="onBlur(input)" @change="onChange(input)" />
    </RxCard>
  </div>
</template>

<style lang="scss" scoped></style>
