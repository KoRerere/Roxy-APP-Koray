<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import drawerContent from '/@/components/drawer-content.vue'
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

const toast = useToast()

const cookie = isEmptyValue(props.data?.cookie) ? '' : JSON.stringify(props.data.cookie, null, 4)

const cookies = ref(cookie)
const loading = ref(false)

function onConfirm() {
  if (cookies.value && checkCookieFormat(cookies.value)) {
    loading.value = true
    emit('confirm', JSON.parse(cookies.value))
  }
  else {
    toast.add({ severity: 'error', summary: $t('Errors occur'), detail: $t('cookie format error'), life: 2500 })
  }
}
</script>

<template>
  <drawerContent :title="$t('为[{workspaceName}-{uid}]编辑 Cookies', { workspaceName, uid: data.windowSortNum })" v-bind="$attrs">
    <Textarea v-model="cookies" class="cookies-textarea" :placeholder="$t('请以 JSON 格式输入 Cookies')" cols="40" :auto-resize="false" />
    <template #footer>
      <div class="flex justify-end w-full">
        <RxButton :label="$t('保存')" :loading="loading" severity="info" @click="onConfirm" />
      </div>
    </template>
  </drawerContent>
</template>

<style lang="scss" scoped>
.cookies-textarea {
  margin-top: var(--spacing-2xl, 16px);
  resize: none;
  height: calc(100% - var(--spacing-2xl, 16px));
}
</style>
