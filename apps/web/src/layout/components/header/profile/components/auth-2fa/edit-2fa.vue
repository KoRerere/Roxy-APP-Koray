<script setup lang="ts">
import { $t } from '/@/locales'
import QRCode2FA from './qrcode-2fa.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useAuth2FA } from './useAuth2FA'
import Action from './action.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

const [showAuth2FA, code2FA] = useAuth2FA();
const visibleQRCode = ref(false)
const [showToast, onlyErrorToast] = useResponseToast()
const qrcode2FA = reactive({
  qrcode: '',
  secret: '',
  code: '',
})

const handleViewCode = () => {
  const dialogInstance = showAuth2FA({
    header: $t('身份验证'),
    handleOk: async () => {
      const { code, msg } = await API.base.getPersonalVerifyValidatorCodeList({ code: code2FA.value, type: 'update_2fa_info' })

      onlyErrorToast(code, msg)
      if (code !== 0) return
      code2FA.value = ''
      dialogInstance.handleCancel()
      getSecret()
    }
  })
}

async function getSecret() {
  const res = await API.base.getValidatorTokenInfoList({})
  onlyErrorToast(res.code, res.msg)
  if (res.code === 0) {
    visibleQRCode.value = true;
    code2FA.value = '';
    qrcode2FA.qrcode = res.data.google_keyuri;
    qrcode2FA.secret = res.data.secret;
  }
}

const reset2FA = async () => {
  const res = await API.base.userUpdateValidatorTokenCreate({
    code: qrcode2FA.code
  })
  onlyErrorToast(res.code, res.msg);
  if (res.code === 0) {
    visibleQRCode.value = false;
    qrcode2FA.code = '';
    qrcode2FA.qrcode = '';
    qrcode2FA.secret = '';
  }
}
</script>

<template>
  <Action @click="handleViewCode" status="normal" v-bind="$attrs" />

  <Dialog class="w-480px" v-model:visible="visibleQRCode" :header="$t('添加新的两步验证方法')" modal :draggable="false">
    <QRCode2FA v-model="qrcode2FA" />

    <template #footer>
      <RxButton :label="$t('确定')" severity="primary" class="w-full" @click="reset2FA" />
    </template>
  </Dialog>
</template>