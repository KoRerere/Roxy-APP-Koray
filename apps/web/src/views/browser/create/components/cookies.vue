<script setup lang="ts">
import RxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'
import { readCookiesFile, validateCookieInput } from '/@/utils'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  platformUrls?: string[]
}>()

const attrs = useAttrs()

const modelValue = defineModel<string>()
const invalid = defineModel('invalid', { default: false })
const errorMsg = ref()

async function onIconClick() {
  const res = await readCookiesFile()
  if (res) {
    if (res.data) {
      modelValue.value = res.data
      invalid.value = false
    }
    else {
      invalid.value = true
      errorMsg.value = res.message
    }
  }
}

function validateCookieValue(value: string) {
  const result = validateCookieInput(value?.trim() ?? '', {
    platformUrls: props.platformUrls,
  })

  if (result.valid) {
    invalid.value = false
    errorMsg.value = undefined
    return true
  }

  invalid.value = true
  errorMsg.value = result.message
  return false
}

function onBlur(event: any) {
  validateCookieValue(event.target.value)
}

watch(() => props.platformUrls, () => {
  if (modelValue.value)
    validateCookieValue(modelValue.value)
}, { deep: true })
</script>

<template>
  <div class="flex min-w-0 w-full px-4">
    <div class="mr-2 tt-primary text-3.25 leading-32px rx-label">
      {{ attrs.label }}
    </div>
    <div class="w-full">
      <RxInputTextarea v-model="modelValue" rows="3" icon="base/rx_ic_attachment" :placeholder="(attrs.placeholder as string) || $t('支持格式: JSON、Netscape、Name=Value\nName=Value 未写 domain 时，将按行从下方平台账号的网址自动填充')" :auto-resize="false" :invalid="invalid" @icon-click="onIconClick"
                       @blur="onBlur"
      />
      <Message v-if="invalid" severity="error" size="small" variant="simple">
        {{ errorMsg }}
      </Message>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
