<script setup lang="ts">
import rxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'
import { $t } from '/@/locales'
import { checkCookieFormat, readCookiesFile } from '/@/utils'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const modelValue = defineModel<string>()
const invalid = defineModel('invalid', { default: false })
const errorMsg = ref($t('Cookie 格式错误，请检查格式'))
const showCookies = ref(!!modelValue.value)

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
  <div class="flex-1 flex flex-col gap-2">
    <div class="flex items-center self-stretch gap-2">
      <div class="flex-1 items-center flex gap-2 title">{{ attrs.label }}</div>
      <RxButton text size="xxs" severity="secondary" icon="base/rx_ic_edit" :label="$t('自定义 cookies')" @click="showCookies = true" />
    </div>
    <rxInputTextarea v-show="showCookies" v-model="modelValue" rows="5" icon="base/rx_ic_attachment" :placeholder="$t('请以 JSON 格式输入 Cookies')" :auto-resize="false" :invalid="invalid"
      @iconClick="onIconClick" @blur="onBlur" />
    <Message v-if="invalid" severity="error" size="small" variant="simple">{{ errorMsg }}</Message>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;
}
</style>
