<template>
  <div class="flex items-center gap-2">
    <RxToggleSwitch v-bind="$attrs" @change="handleChange" />
    <RxButton v-if="!!lockStore.lockData.password" severity="secondary" outlined @click="handleResetPassword">{{
      $t('重置密码') }}</RxButton>
  </div>
  <Dialog v-model:visible="visible" :header="$t('重置密码')" :modal="true" :draggable="false" style="width: 384px;">
    <div class="flex flex-col gap-4">
      <span class="text-sm text-gray-500">
        {{ $t('设置密码以解锁应用程序请使用 4-12 个字符（字母、数字或符号）。') }}
      </span>

      <RxInputText v-model="password" @blur="handleBlur" :invalid="invalid" @keydown.enter="onKeyDown" />
      
      <RxButton @click="handleSubmit">{{ dialogType === DialogType.SET_PASSWORD ? $t('设置密码') : $t('重置密码') }}
      </RxButton>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from "/@/components/rx-toggle-switch";
import { $t } from "/@/locales";
import { z } from 'zod'
import { useLock } from '/@/stores/lock'
import type { Items } from '../type'

const lockStore = useLock()

enum DialogType {
  SET_PASSWORD = 0,
  RESET_PASSWORD = 1,
}

defineOptions({
  inheritAttrs: false,
})

const props = defineProps({
  item: {
    type: Object as PropType<Items>,
    required: true,
  },
})

const emit = defineEmits(['change'])

const password = ref('')

const visible = ref(false)

const invalid = ref(false)

// 0为设置密码，1为重置密码
const dialogType = ref<DialogType>(DialogType.SET_PASSWORD)

const handleChange = (e: Event) => {
  if ((e.target as HTMLInputElement).checked) {
    // 打开时
    visible.value = true
    dialogType.value = DialogType.SET_PASSWORD
  } else {
    // 关闭时
    emit('change', { password: '' })
  }
}

const handleResetPassword = () => {
  dialogType.value = DialogType.RESET_PASSWORD
  visible.value = true
}

const handleBlur = () => {
  const schema = z.string()
    .min(4)
    .max(12)
    .regex(/^[^\u4e00-\u9fa5]+$/)

  const result = schema.safeParse(password.value)
  invalid.value = !result.success
  return result.success
}

const handleSubmit = () => {
  if (!invalid.value && password.value) {
    emit('change', { password: password.value })
    visible.value = false
    password.value = ''
  }
}

function onKeyDown() {
  const success = handleBlur();
  if (success) {
    handleSubmit();
  }
}
</script>
