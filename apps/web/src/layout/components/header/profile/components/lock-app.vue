<template>
  <div class="flex items-center gap-2">
    <RxToggleSwitch v-bind="$attrs" v-model="modelValue" @change="handleToggle" />
    <RxButton v-if="!!lockStore.lockData.password" severity="secondary" outlined @click="handleResetPassword">{{
      $t('重置密码') }}</RxButton>
  </div>
  <Dialog v-model:visible="visible" @hide="handleHide" :header="$t('重置密码')" :modal="true" :draggable="false" style="width: 384px;">
    <div class="flex flex-col gap-4">
      <span class="text-sm text-gray-500">
        {{ $t('设置密码以解锁应用程序请使用 4-12 个字符（字母、数字或符号）。') }}
      </span>

      <Password 
        v-model="password" 
        @change="invalid = false" 
        @blur="handleBlur" 
        :invalid="invalid" 
        @keydown.enter="onKeyDown" 
        :feedback="false"
        toggleMask
        :pt="{
          pcInputText: {
            root: {
              class: '!w-full'
            }
          }
        }"
      />

      <template v-if="invalid">
        <Message severity="error" size="small" variant="simple" class="error-message" v-for="issue in errorIssues">
          {{ issue.message }}
        </Message>
      </template>
      
      <RxButton @click="handleSubmit">{{ dialogType === DialogType.SET_PASSWORD ? $t('设置密码') : $t('重置密码') }}
      </RxButton>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from "/@/components/rx-toggle-switch";
import { $t } from "/@/locales";
import { z, type ZodIssue } from 'zod'
import { useLock } from '/@/stores/lock'

const lockStore = useLock()

enum DialogType {
  SET_PASSWORD = 0,
  RESET_PASSWORD = 1,
}

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<boolean>()

const emit = defineEmits(['change'])

const password = ref('')

const visible = ref(false)

const invalid = ref(false)

const errorIssues = ref<ZodIssue[]>([])

// 0为设置密码，1为重置密码
const dialogType = ref<DialogType>(DialogType.SET_PASSWORD)

const handleToggle = (e: Event) => {
  if ((e.target as HTMLInputElement).checked) {
    // 打开时
    visible.value = true
    dialogType.value = DialogType.SET_PASSWORD
    password.value = ''
  } else {
    // 关闭时
    emit('change', '')
  }
}

const handleResetPassword = () => {
  dialogType.value = DialogType.RESET_PASSWORD
  visible.value = true
  password.value = ''
}

const handleBlur = () => {
  if (!password.value) return;
  
  const schema = z.string()
    .min(4, { message: $t('密码长度需为 4-12 位。') })
    .max(12, { message: $t('密码长度需为 4-12 位。') })
    .regex(/^[^\u4e00-\u9fa5]+$/, { message: $t('密码中包含不允许的字符。请使用字母、数字以及符号组合。') })

  const result = schema.safeParse(password.value)
  invalid.value = !result.success
  if (!result.success) {
    errorIssues.value = result.error?.issues || []
  }
  return result.success
}

const handleSubmit = () => {
  if (!invalid.value && password.value) {
    emit('change', password.value)
    visible.value = false
  }
}

function handleHide() {
  // 主要解决用户打开应用上锁，没设置密码就关闭弹窗，此时modelValue的值已经改了。
  // 延迟时间是为了设置了密码回调没有这个回调快，就会导致设置了密码后，modelValue又被改回去了
  setTimeout(() => {
    modelValue.value = !!lockStore.lockData.password;
  }, 300)
}

function onKeyDown() {
  const success = handleBlur();
  if (success) {
    handleSubmit();
  }
}
</script>
