<script setup lang="ts">
import { checkCookieFormat, isEmptyValue } from '/@/utils'
import drawerContent from '/@/components/drawer-content.vue'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '创建代理',
  },
})

const emit = defineEmits(['confirm'])

const toast = useToast()

const cookie = isEmptyValue(props.data.cookie) ? '' : JSON.stringify(props.data.cookie)

const cookies = ref(cookie)
const isWrap = ref(false)
const loading = ref(false)

function onConfirm() {
  if (cookies.value && checkCookieFormat(cookies.value)) {
    loading.value = true
    emit('confirm', JSON.parse(cookies.value))
  }
  else {
    toast.add({ severity: 'error', summary: 'Error', detail: 'cookie 格式错误', life: 5000 })
  }
}
</script>

<template>
  <drawerContent title="编辑 cookies" v-bind="$attrs">
    <Textarea v-model="cookies" class="cookies-textarea" placeholder="Paste your cookie with JSON format" cols="40"
      :auto-resize="false" />
    <template #footer>
      <div class="flex justify-between w-full">
        <div class="flex items-center">
          <Checkbox v-model="isWrap" input-id="wrap" binary />
          <label for="wrap" class="select-none ml-2 cursor-pointer">Text wrap</label>
        </div>
        <ry-button label="Save Cookies" :loading="loading" severity="info" @click="onConfirm" />
      </div>
    </template>
  </drawerContent>
</template>

<style lang="scss" scoped>
.cookies-textarea {
  // margin: var(--spacing-2xl, 16px) 0;
  margin-top: var(--spacing-2xl, 16px);
  resize: none;
  height: calc(100% - var(--spacing-2xl, 16px));
}
</style>
