<script setup lang="ts">
import RxToggleSwitch from "/@/components/rx-toggle-switch";
import { RxSvgIcon } from '/@/components/rx-icon'

import VerifyEmail from './verify-email.vue'
import Verify2FA from './verify-2fa.vue'
import { API } from "/@/api";
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import Setps2FA from './setps-2fa.vue'

const props = defineProps<{
  defaultValue: boolean
  onChange?: (val: 'code' | 'email' | 'close') => void
}>()

const modelValue = defineModel<boolean>('modelValue')
const visibleEmail = ref(false)
const visible2FA = ref(false)
const visibleClose2FA = ref(false)

const [showToast, onlyErrorToast] = useResponseToast()

const emailCode = ref('')

const qrcode2FA = reactive({
  qrcode: '',
  secret: '',
  code: '',
})

const close2faCode = ref('')

const handleChange = () => {
  if (!modelValue.value) {
    // 开启 2FA
    visibleEmail.value = true;
  } else {
    // 关闭 2FA
    visibleClose2FA.value = true;
  }
}

const verifyEmailCode = async () => {
  const res = await API.base.userVerifyValidatorVerifyCodeList({
    ver_code: emailCode.value,
  })
  onlyErrorToast(res.code, res.msg)
  if (res.code === 0) {
    emailCode.value = '';
    visibleEmail.value = false;
    visible2FA.value = true
  }
}

// 关闭 2FA 。
const verifyClose2FACode = async () => {
  const res = await API.base.userCloseValidatorCreate({
    code: close2faCode.value,
  })
  onlyErrorToast(res.code, res.msg)
  if (res.code === 0) {
    visibleClose2FA.value = false;
    modelValue.value = false;
    props.onChange?.('close');
  }
}

const hideDialog = () => {
  modelValue.value = props.defaultValue;
  visibleEmail.value = false;
  visible2FA.value = false;
  visibleClose2FA.value = false;
  close2faCode.value = ''
}

const handleSuccess = (type: 'code' | 'email') => {
  visible2FA.value = false;
  props.onChange?.(type);
}

</script>

<template>
  <RxToggleSwitch v-model="modelValue" @change="handleChange" v-bind="$attrs" />

  <Dialog class="w-384px fa-dialog" v-model:visible="visibleEmail" :header="$t('开启 2FA')" modal :draggable="false">
    <VerifyEmail :request="API.base.userSendValidatorVerifyCodeList" v-model="emailCode" />
    <template #footer>
      <RxButton :label="$t('下一步')" severity="primary" class="w-full" @click="verifyEmailCode" />
    </template>
    <template #closeicon>
      <div @click.stop="hideDialog" class="wh-full flex justify-center items-center">
        <RxSvgIcon name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" />
      </div>
    </template>
  </Dialog>

  <Setps2FA v-model:visible="visible2FA" @success="handleSuccess" @cancel="hideDialog" />

  <Dialog class="w-384px" v-model:visible="visibleClose2FA" :header="$t('关闭 2FA')" modal :draggable="false">
    <Verify2FA v-model="close2faCode" />
    <template #footer>
      <RxButton :label="$t('确定')" severity="primary" class="w-full" @click="verifyClose2FACode" />
    </template>

    <template #closeicon>
      <div @click.stop="hideDialog" class="wh-full flex justify-center items-center">
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
