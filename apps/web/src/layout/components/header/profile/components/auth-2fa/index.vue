<script setup lang="ts">
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import { RxSvgIcon } from '/@/components/rx-icon'

import VerifyEmail from './verify-email.vue'
import Verify2FA from './verify-2fa.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import Setps2FA from './setps-2fa.vue'

const props = defineProps<{
  defaultValue: boolean
  enableBefore?: () => Promise<boolean> | boolean
  onChange?: (val: 'code' | 'email' | 'close') => void
}>()

const modelValue = defineModel<boolean>('modelValue')
const visibleEmail = ref(false)
const visible2FA = ref(false)
const visibleClose2FA = ref(false)

const [_, onlyErrorToast] = useResponseToast()

const emailCode = ref('')

const close2faCode = ref('')

async function handleChange() {
  if (!modelValue.value) {
    const enableBefore = await props.enableBefore?.()
    if (enableBefore === false) {
      hideDialog()
      return
    }
    // 开启 2FA
    visibleEmail.value = true
  }
  else {
    // 关闭 2FA
    visibleClose2FA.value = true
  }
}

async function verifyEmailCode() {
  const res = await API.base.userVerifyValidatorVerifyCodeList({
    ver_code: emailCode.value.trim(),
  })
  onlyErrorToast(res.code, res.msg)
  if (res.code === 0) {
    emailCode.value = ''
    visibleEmail.value = false
    visible2FA.value = true
  }
}

/**
 * 关闭 2FA 。
 */
async function verifyClose2FACode() {
  const res = await API.base.userCloseValidatorCreate({
    code: close2faCode.value,
  })
  onlyErrorToast(res.code, res.msg)
  if (res.code === 0) {
    visibleClose2FA.value = false
    modelValue.value = false
    close2faCode.value = ''
    props.onChange?.('close')
  }
}

function hideDialog() {
  modelValue.value = props.defaultValue
  visibleEmail.value = false
  visible2FA.value = false
  visibleClose2FA.value = false
  close2faCode.value = ''
}

function handleSuccess(type: 'code' | 'email') {
  visible2FA.value = false
  props.onChange?.(type)
}
</script>

<template>
  <RxToggleSwitch v-model="modelValue" v-bind="$attrs" @change="handleChange" />

  <Dialog v-model:visible="visibleEmail" class="w-384px fa-dialog" :header="$t('验证当前邮箱')" modal :draggable="false">
    <VerifyEmail v-model="emailCode" :request="API.base.userSendValidatorVerifyCodeList" />
    <template #footer>
      <RxButton :label="$t('下一步')" severity="primary" class="w-full" @click="verifyEmailCode" />
    </template>
    <template #closeicon>
      <div class="wh-full flex justify-center items-center" @click.stop="hideDialog">
        <RxSvgIcon name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" />
      </div>
    </template>
  </Dialog>

  <Setps2FA v-model:visible="visible2FA" :on-cancel="hideDialog" @success="handleSuccess" />

  <Dialog v-model:visible="visibleClose2FA" class="w-384px" :header="$t('关闭 2FA')" modal :draggable="false">
    <Verify2FA v-model="close2faCode" />
    <template #footer>
      <RxButton :label="$t('确定')" severity="primary" class="w-full" @click="verifyClose2FACode" />
    </template>

    <template #closeicon>
      <div class="wh-full flex justify-center items-center" @click.stop="hideDialog">
        <RxSvgIcon name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" />
      </div>
    </template>
  </Dialog>
</template>

<style>
.fa-dialog .p-dialog-close-button {
  padding: 0 !important;
}
</style>
