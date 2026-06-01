<script setup lang="ts">
import RxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'
import { checkCookieFormat, readCookiesFile } from '/@/utils'

defineOptions({
  inheritAttrs: false,
})

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

function onBlur(event: any) {
  if (checkCookieFormat(event.target.value)) {
    invalid.value = false
    return
  }

  invalid.value = true
  errorMsg.value = $t('Cookie 格式错误，请检查格式')
}
</script>

<template>
  <div class="flex min-w-0 w-full px-4">
    <div class="mr-2 tt-primary text-3.25 leading-32px rx-label">
      {{ attrs.label }}
    </div>
    <div class="w-full">
      <RxInputTextarea v-model="modelValue" rows="3" icon="base/rx_ic_attachment" :placeholder="$t('请以 JSON 格式输入 Cookies')" :auto-resize="false" :invalid="invalid" @icon-click="onIconClick"
                       @blur="onBlur"
      />
      <Message v-if="invalid" severity="error" size="small" variant="simple">
        {{ errorMsg }}
      </Message>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
