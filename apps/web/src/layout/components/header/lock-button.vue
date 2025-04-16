<template>
  <RxButton icon="base/rx_ic_unlock2" severity="secondary" outlined size="xs" @click="handleOpenLocker" />

  <Dialog v-model:visible="visible" @hide="handleHide" :header="$t('设置锁定密码')" :modal="true" :draggable="false" style="width: 384px;">
    <div class="flex flex-col gap-4">
      <span class="text-sm text-gray-500">
        {{ $t('密码格式：4-12 个字符（字母、数字或符号）') }}
      </span>

      <RxForm 
        v-model="form" 
        :schemas="schemas" 
        layout="vertical"
        ref="formRef"
        @keypress.enter="handleSubmit"
        :footer="false"
      >
      </RxForm>

      <RxButton @click="handleSubmit" class="w-full mt-[8px]">{{ $t('确认并上锁') }}</RxButton>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import RxButton from '/@/components/rx-button'
import { $t } from "/@/locales";
import { useLock } from '/@/stores/lock'
import { defineFormSchema } from '/@/components/rx-form'

const { lockData, openLockMark, setPassword } = useLock()

const handleOpenLocker = () => {
  if (lockData.password) {
    openLockMark()
  } else {
    // 先设置密码
    // 密码设置成功后就上锁
    visible.value = true
  }
}

defineOptions({
  inheritAttrs: false,
})

const form = ref({
  password: '',
  confirmPassword: '',
})
const formRef = ref()
const schemas = defineFormSchema([
  {
    field: 'password',
    label: $t('密码'),
    component: 'Password',
    defaultValue: '',
    componentProps: {
      toggleMask: true,
      feedback: false,
      placeholder: $t('请输入密码'),
      autofocus: true,
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(4, { message: $t('密码长度需为 4-12 位') })
          .max(12, { message: $t('密码长度需为 4-12 位') })
          .regex(/^[^\u4e00-\u9fa5]+$/, { message: $t('密码中包含不允许的字符。请使用字母、数字以及符号组合。') })
      },
    },
  },
  {
    field: 'confirmPassword',
    label: $t('确认密码'),
    component: 'Password',
    defaultValue: '',
    componentProps: {
      toggleMask: true,
      feedback: false,
      placeholder: $t('请再次输入您的密码'),
    },
    rule: {
      trigger: 'blur',
      validator(zod, data) {
        return zod.string()
          .refine((val) => {
            return val === data.value.password
          }, {
            message: $t('两次输入的密码不一致'),
          })
      },
    },
  },
])

const visible = ref(false)

const handleSubmit = async () => {
  try {
    const formValue = await formRef.value.handleSubmit()
    setPassword(formValue.confirmPassword)
    visible.value = false
    openLockMark();
  } catch(error) {
    // ... 不用处理这个错误，界面上会有提示
  }
}

function handleHide() {
  formRef.value?.resetFields()
  form.value = {
    password: '',
    confirmPassword: '',
  }
}
</script>

<style lang="scss" module="lockScreen">
.mask {
  background: var(--Colors-background-bg-blur, rgba(255, 255, 255, 0.60)) !important;
  backdrop-filter: blur(30px);
  display: block !important;
}

.mask-root {
  position: absolute;
  width: 100%;
  height: 100%;
  // 重置一些样式
  background-color: transparent;
  border: none;
  box-shadow: none;
  max-height: 100% !important;
}

.mask-content {
  height: 100%;
  width: 100%;
}
</style>