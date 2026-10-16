<script setup lang="ts">
import InputLabel from '/@/components/ry-form/input-label.vue'
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
const invalid = defineModel<boolean>('invalid', { default: false })
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
  if (modelValue.value) {
    validateCookieValue(modelValue.value)
  }
}, { deep: true })
</script>

<template>
  <div class="flex min-w-0 w-full">
    <!-- <div class="mr-2 shrink-0 tt-primary text-3.25 leading-32px rx-label">
      {{ attrs.label }}
    </div> -->

    <InputLabel class="shrink-0 max-w-25 !min-w-25 text-right" :label="(attrs.label as string)" :tooltip="$t('Cookies 用于保存网站的登录状态和会话信息。导入后将在打开窗口时自动写入，可用于迁移或恢复网站登录状态。')" />

    <div class="min-w-0 flex-1">
      <RxInputTextarea v-model="modelValue" rows="3" icon="base/rx_ic_attachment" :placeholder="(attrs.placeholder as string) || $t('选填\n支持格式: JSON、Netscape、Name=Value\nName=Value 未写 domain 时，将按行从平台账号的网址自动填充')" :auto-resize="false" :invalid="invalid" @icon-click="onIconClick"
                       @blur="onBlur"
      />
      <Message v-if="invalid" severity="error" size="small" variant="simple">
        {{ errorMsg }}
      </Message>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
