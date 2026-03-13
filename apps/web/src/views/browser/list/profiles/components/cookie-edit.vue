<script setup lang="ts">
import TsFormInputTextarea from '/@/views/lab/components/form/m-input-textarea.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { checkCookieFormat, isEmptyValue } from '/@/utils'

const { data } = defineProps<{
  data?: any
}>()

const emit = defineEmits(['confirm'])
const [_, onlyErrorToast] = useResponseToast()

const cookies = ref('')
const loading = ref(false)

onBeforeMount(() => {
  getCookie()// 获取最新 cookie 信息
})

async function getCookie() {
  if (!data?.id)
    return
  const { data: { rows: [item] } } = await API.window.userGetWindowInfoV2List({ windowIds: data.id, isDelete: 0, page_index: 1, page_size: 1 })
  cookies.value = isEmptyValue(item.cookie) ? '' : JSON.stringify(item.cookie, null, 2)
}

function onConfirm() {
  const cookieStr = cookies.value?.trim() || ''
  if (cookieStr && checkCookieFormat(cookieStr)) {
    loading.value = true
    emit('confirm', JSON.parse(cookieStr))
  }
  else {
    if (cookieStr === '') {
      emit('confirm', [])
    }
    else {
      onlyErrorToast(-1, $t('Cookie 格式错误，请检查格式'))
    }
  }
}
</script>

<template>
  <div class="flex flex-col pt-4 px-4 min-w-124">
    <div class="flex-1">
      <TsFormInputTextarea v-model="cookies" :field-props="{ pt: { root: 'h-full' } }" :placeholder="$t('请以 JSON 格式输入 Cookies')" cols="40" :auto-resize="false" :pt="{ root: 'h-full' }" />
    </div>
    <div class="flex justify-end pt-4 pb-5">
      <RxButton :label="$t('保存')" :loading="loading" @click="onConfirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
