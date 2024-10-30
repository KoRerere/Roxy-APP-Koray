<script setup lang="ts">
import RxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { checkCookieFormat, isEmptyValue } from '/@/utils'

const props = defineProps({
  workspaceName: {
    type: String,
  },
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['confirm'])
const [_, onlyErrorToast] = useResponseToast()

const cookie = isEmptyValue(props.data?.cookie) ? '' : JSON.stringify(props.data.cookie, null, 4)

const cookies = ref(cookie)
const loading = ref(false)

function onConfirm() {
  if (cookies.value && checkCookieFormat(cookies.value)) {
    loading.value = true
    emit('confirm', JSON.parse(cookies.value))
  }
  else {
    onlyErrorToast(-1, $t('Cookie 格式错误，请检查格式'))
  }
}
</script>

<template>
  <div class="flex flex-col h-full proxy-content">
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
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) 0;
  width: var(--width-xs, 384px);
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
