<script setup lang="ts">
import { useAuth2FA } from './useAuth2FA'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon'
import { $t } from '/@/locales'
import RecoveryEmail from './recovery-email.vue'
import Action from './action.vue'

const [showAuth2FA, code2FA] = useAuth2FA()
const email2FA = ref('')
const email2FACode = reactive({
  email: '',
  emailError: false,
  code: '',
  codeError: false,
})
const visible = ref(false)
const visibleChangeEmail = ref(false)

const handleViewCode = () => {
  showAuth2FA({
    header: $t('查看恢复邮箱'),
    handleOk: async () => {
      // 
    }
  })
}

const changeEmail = () => {
  visibleChangeEmail.value = true;
};

const sendCodeRequest = async () => {}
</script>
<template>
  <Action @click="handleViewCode" status="normal" v-bind="$attrs" />
  <Dialog class="w-480px" v-model:visible="visible" :header="$t('恢复代码')" modal :draggable="false">
    <div class="flex flex-col gap-12px">
      <div class="text-14px font-600 font-[Inter] leading-[20px] text-[var(--colors-text-text-primary)]">{{ $t('您的恢复电子邮件') }}</div>
      <div class="text-12px font-400 font-[Inter] leading-[18px] text-[var(--colors-text-text-secondary)]">{{ $t('您可以使用恢复电子邮件作为第二个因素进行身份验证，以防您无法访问您的设备。') }}</div>
      <div class="flex flex-col gap-4px">
        <label for="email">{{ $t('恢复邮箱') }}</label>
        <InputText v-model="email2FA" name="email" class="w-full" disabled :placeholder="$t('请输入您的邮箱地址')" />
      </div>
    </div>
    <template #footer>
      <div class="w-full flex flex-col gap-12px">
        <RxButton :label="$t('确认')" severity="primary" class="w-full" @click="" />
        <RxButton :label="$t('更换邮件')" severity="secondary" class="w-full" @click="changeEmail"
          outlined />
      </div>
    </template>
  </Dialog>

  <Dialog class="w-480px" v-model:visible="visibleChangeEmail" :header="$t('恢复邮箱')" modal :draggable="false">
    <RecoveryEmail v-model="email2FACode" :sendCodeRequest="sendCodeRequest" />
    <template #footer>
      <div class="w-full flex flex-col gap-12px">
        <RxButton :label="$t('确认')" severity="primary" class="w-full" @click="" />
        <RxButton :label="$t('取消')" severity="secondary" class="w-full" outlined />
      </div>
    </template>
  </Dialog>
</template>