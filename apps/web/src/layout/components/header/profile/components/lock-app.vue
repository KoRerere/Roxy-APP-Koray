<template>
  <div class="flex items-center gap-2">
    <RxToggleSwitch v-bind="$attrs" @change="handleChange" />
    <RxButton v-if="!!lockStore.lockData.password" severity="secondary" outlined @click="handleResetPassword">{{
      $t('重置密码') }}</RxButton>
  </div>
  <Dialog v-model:visible="visible" :header="$t('重置密码')" :modal="true" :draggable="false" :resizable="false"
    :closable="false">
    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-2">
        <span class="text-sm text-gray-500">
          {{ $t('设置密码以解锁应用程序请使用 4-12 个字符（字母、数字或符号）。') }}
        </span>

        <RxInputText v-model="password" @blur="handleBlur" :invalid="invalid" />
        <template v-if="invalid">
          <Message v-for="msg in issues" severity="error" size="small" variant="simple" class="error-message">
            {{ msg }}
          </Message>
        </template>
        <RxButton @click="handleSubmit">{{ dialogType === DialogType.SET_PASSWORD ? $t('设置密码') : $t('重置密码') }}
        </RxButton>
      </div>
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

const issues = ref<string[]>([])

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
    .min(4, $t('密码长度必须在 4-12 个字符之间'))
    .max(12, $t('密码长度必须在 4-12 个字符之间'))
    .regex(/^[a-zA-Z0-9]+$/, $t('密码必须由字母、数字或符号组成'))

  const result = schema.safeParse(password.value)
  invalid.value = !result.success
  issues.value = result.error?.issues.map(issue => issue.message) ?? []
}

const handleSubmit = () => {
  emit('change', { password: password.value })
  visible.value = false
}
</script>
