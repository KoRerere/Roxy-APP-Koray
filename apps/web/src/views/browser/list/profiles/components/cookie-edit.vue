<script setup lang="ts">
import TsFormInputTextarea from '/@/views/lab/components/form/m-input-textarea.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { checkCookieFormat, isEmptyValue, parseCookies, stringifyCookies } from '/@/utils'
import type { ParsedCookie } from '/@/utils/cookie'

const { data } = defineProps<{
  data?: any
}>()

const emit = defineEmits<{
  confirm: [cookie: ParsedCookie[]]
}>()
const [_, onlyErrorToast] = useResponseToast()

const cookies = ref('')
const loading = ref(false)
const invalid = ref(false)

onBeforeMount(() => {
  getCookie()// 获取最新 cookie 信息
})

async function getCookie() {
  if (!data?.id)
    return
  const { data: { rows: [item] } } = await API.window.userGetWindowInfoV2List({ windowIds: data.id, isDelete: 0, page_index: 1, page_size: 1 })
  cookies.value = isEmptyValue(item.cookie) ? '' : stringifyCookies(item.cookie)
}

function onBlur(event: FocusEvent) {
  const value = (event.target as HTMLTextAreaElement).value
  if (checkCookieFormat(value)) {
    invalid.value = false
    return
  }

  invalid.value = true
}

function onConfirm() {
  const cookieStr = cookies.value?.trim() || ''
  if (!cookieStr) {
    loading.value = true
    emit('confirm', [])
    return
  }

  if (!checkCookieFormat(cookieStr)) {
    invalid.value = true
    onlyErrorToast(-1, $t('Cookie 格式错误，请检查格式'))
    return
  }

  loading.value = true
  emit('confirm', parseCookies(cookieStr) ?? [])
}
</script>

<template>
  <div class="flex flex-col pt-4 px-4 min-w-124">
    <div class="flex-1">
      <TsFormInputTextarea v-model="cookies" :field-props="{ pt: { root: 'h-full' } }" :placeholder="$t('支持格式: JSON、Netscape、Name=Value\nName=Value 格式行首必须指定 domain=...; 字段值，否则无效')" cols="40" :auto-resize="false"
                           :invalid="invalid" :pt="{ root: 'h-full' }" @blur="onBlur"
      />
      <Message v-if="invalid" severity="error" size="small" variant="simple">
        {{ $t('Cookie 格式错误，请检查格式') }}
      </Message>
    </div>
    <div class="flex justify-end pt-4 pb-5">
      <RxButton :label="$t('保存')" :loading="loading" @click="onConfirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
