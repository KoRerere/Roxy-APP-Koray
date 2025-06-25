<script setup lang="ts">
import { $t } from '/@/locales'
import { useAuth2FA } from './useAuth2FA'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import Action from './action.vue'
import RecoveryCodes from './recovery-codes.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'

const [showAuth2FA, code2FA] = useAuth2FA()
const visible = ref(false)
const recoveryCodes = ref<string[]>([])
const isGenerated = ref(false)
const [showToast, onlyErrorToast] = useResponseToast()

const handleViewCode = () => {
  const dialogInstance = showAuth2FA({
    header: $t('查看恢复代码'),
    handleOk: async () => {
      const res = await API.base.userGetValidatorInfoList({
        code: code2FA.value,
      })
      onlyErrorToast(res.code, res.msg);
      if (res.code === 0) {
        code2FA.value = '';
        dialogInstance.handleCancel()
        recoveryCodes.value = res.data.recoverCode
        visible.value = true
      }
    }
  })
}

const generateNewCode = async () => {
  const res = await API.base.generateValidatorRecoverCodeList({
    type: 'modify'
  })
  onlyErrorToast(res.code, res.msg)
  if (res.code === 0) {
    isGenerated.value = true
    recoveryCodes.value = res.data;
  }
}

const handleHide = () => {
  recoveryCodes.value = [];
  isGenerated.value = false;
}

const handleConfirm = async () => {
  const { code, msg } = await API.base.validatorBindCreate({ recover_type: 'code' })
  onlyErrorToast(code, msg)
  if (code !== 0) return
  visible.value = false
}
</script>

<template>
  <Action @click="handleViewCode" status="normal" v-bind="$attrs" />

  <Dialog class="w-480px" v-model:visible="visible" :header="$t('恢复代码')" modal :draggable="false" @hide="handleHide">
    <RxAlert v-model:visible="isGenerated" class="!w-full mb-3 checkermessage" type="success" :title="$t('您的新恢复代码已生成')">
      <template #content>
        {{ $t('请仔细保存您的新恢复代码。请注意，旧恢复代码将不再有效。') }}
      </template>
    </RxAlert>
    <RecoveryCodes v-model="recoveryCodes" />
    <template #footer>
      <div class="w-full flex flex-col gap-12px">
        <RxButton :label="$t('我已保存新恢复代码')" severity="primary" class="w-full" @click="handleConfirm" />
        <RxButton :label="$t('生成新的恢复代码')" severity="secondary" class="w-full" @click="generateNewCode" outlined />
      </div>
    </template>
  </Dialog>
</template>