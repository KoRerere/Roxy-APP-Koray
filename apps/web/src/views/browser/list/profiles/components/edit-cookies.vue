<script setup lang="ts">
import { API } from '/@/api'
import RxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { checkCookieFormat, isEmptyValue } from '/@/utils'

const props = defineProps<{
  data?: any
}>()

const emit = defineEmits(['confirm'])
const [_, onlyErrorToast] = useResponseToast()

const cookies = ref<string>('')
const loading = ref(false)

onBeforeMount(() => {
  getCookie()//获取最新 cookie 信息
})

async function getCookie() {
  if (!props.data?.id) return
  const { data: { rows: [data] } } = await API.window.userGetWindowInfoV2List({ windowIds: props.data.id, isDelete: 0, page_index: 1, page_size: 1 })
  cookies.value = isEmptyValue(data.cookie) ? '' : JSON.stringify(data.cookie, null, 2)
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
    } else {
      onlyErrorToast(-1, $t('Cookie 格式错误，请检查格式'))
    }
  }
}
</script>

<template>
  <div class="flex flex-col pt-4 px-4 proxy-content">
    <div class="flex-1">
      <RxInputTextarea v-model="cookies" :placeholder="$t('请以 JSON 格式输入 Cookies')" cols="40" :auto-resize="false" />
    </div>
    <div class="flex justify-end button-group">
      <RxButton :label="$t('保存')" :loading="loading" severity="info" @click="onConfirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxy-content {
  min-width: var(--width-xs, 496px);
}

:deep(.p-iconfield) {
  height: 100%;

  .p-textarea {
    height: 100%;
  }
}

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}
</style>
