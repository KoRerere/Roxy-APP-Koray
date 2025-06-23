<script setup lang="ts">
import { $t } from '/@/locales'
import QRCode2FA from './qrcode-2fa.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useAuth2FA } from './useAuth2FA'
import Action from './action.vue'

const [showAuth2FA, code2FA] = useAuth2FA();
const visibleQRCode = ref(false)

const handleViewCode = () => {
  showAuth2FA({
    header: $t('确认访问'),
    handleOk: async () => {
      visibleQRCode.value = true;
    }
  })
}

const reset2FA = async () => {
  visibleQRCode.value = false;
}
</script>

<template>
  <Action @click="handleViewCode" status="normal" v-bind="$attrs" />

  <Dialog class="w-480px" v-model:visible="visibleQRCode" :header="$t('添加新的双因素方法')" modal :draggable="false">
    <QRCode2FA />

    <template #footer>
      <RxButton :label="$t('确定')" severity="primary" class="w-full" @click="reset2FA" />
    </template>
  </Dialog>
</template>