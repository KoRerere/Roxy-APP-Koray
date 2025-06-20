<script setup lang="ts">
import RxToggleSwitch from "/@/components/rx-toggle-switch";
import QRCode from 'qrcode'
import { RxSvgIcon } from '/@/components/rx-icon'
import { copyText } from '/@/utils';
import { type SetpsRef } from '/@/components/rx-steps'
import { useUserStore } from '/@/stores/user'
import Bind2Fa from './bind-2fa.vue'
import RecoveryCodes from './recovery-codes.vue'
import RecoveryEmail from './recovery-email.vue'
import VerifyEmail from './verify-email.vue'
import { API } from "/@/api";

const enable2FA = ref(false)
const visibleEmail = ref(false)
const visible2FA = ref(false)
const currentSetp = ref('1')
const stepsRef = useTemplateRef<SetpsRef>('stepsRef')
const secret = ref('LBOUA5BRGJPRKFAQ')
const recoveryType = ref<'codes' | 'email'>();
const copied = ref(false)
const { userInfo } = useUserStore()

const steps = [
  {
    key: '1',
    label: '验证手机号',
    icon: 'base/rx_ic_check'
  },
  {
    key: '2',
    label: '验证邮箱',
    icon: 'base/rx_ic_check'
  },
  {
    key: '3',
    label: '验证邮箱',
  }
]

const qrcodeBase64 = ref()

const generateQrcode = async () => {
  const qrcode = await QRCode.toDataURL('otpauth://totp/roxy:anbin?secret=LBOUA5BRGJPRKFAQ&period=30&digits=6&algorithm=SHA1&issuer=roxy')
  qrcodeBase64.value = qrcode
}

generateQrcode();

const sendCode = () => {

}

const onCopySecret = () => {
  copyText(secret.value)
  copied.value = true
}

const chooseRecovery = (type: 'codes' | 'email') => {
  recoveryType.value = type
  stepsRef.value?.next();
}

const next = () => {
  stepsRef.value?.next();
}

const prev = () => {
  stepsRef.value?.prev();
}


watchEffect(() => {
  if (enable2FA.value) {
    API.base.userSendValidatorVerifyCodeList().then()
    visibleEmail.value = true
  }
})

</script>

<template>
  <RxToggleSwitch v-model="enable2FA" />

  <Dialog class="w-384px" v-model:visible="visibleEmail" :header="$t('开启 2FA')" modal :draggable="false">
    <VerifyEmail />
    <template #footer>
      <RxButton :label="$t('下一步')" severity="primary" class="w-full" />
    </template>
  </Dialog>

  <Dialog class="w-[480px]" v-model:visible="visible2FA" :header="$t('添加新的双重验证方法')" modal :draggable="false">

    <RxSteps class="px-24px mb-24px" v-model="currentSetp" :steps="steps" ref="stepsRef" />

    <!-- 步骤一 -->
    <template v-if="currentSetp === '1'">
      <Bind2Fa />
    </template>

    <!-- 步骤二 -->
    <template v-if="currentSetp === '2'">
      <div class="flex flex-col gap-24px">
        <div class="flex flex-col gap-16px">
          <div class="text-14px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">
            {{ $t('选择您的恢复方法') }}
          </div>
          <div class="text-12px font-[Inter] font-400 text-[var(--colors-text-text-secondary)]">
            {{ $t('选择以下恢复方法之一，当您无法使用身份验证器应用时，这些方法可以用作双重身份验证 (2FA)。') }}
          </div>
        </div>

        <div class="flex gap-12px">
          <div
            class="flex-1 flex flex-col items-center border-1 border-solid border-[var(--colors-border-border-subtle)] rounded-8px px-16px py-12px">
            <div class="flex flex-col gap-2px w-full">
              <div class="text-14px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('恢复代码') }}</div>
              <div class="text-12px font-[Inter] font-400 text-[var(--colors-text-text-secondary)]">{{
                $t('保存一组可用作双重身份验证的恢复代码') }}</div>
            </div>
            <RxSvgIcon name="base/rx_ic_recovery_codes" size="100" color="var(--colors-icon-icon-secondary)" />
            <div class="flex justify-end w-full">
              <RxButton :label="$t('选择')" severity="secondary" outlined @click="chooseRecovery('codes')" />
            </div>
          </div>

          <div
            class="flex-1 flex flex-col items-center border-1 border-solid border-[var(--colors-border-border-subtle)] rounded-8px px-16px py-12px">
            <div class="flex flex-col gap-2px w-full">
              <div class="text-14px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('恢复邮箱') }}</div>
              <div class="text-12px font-[Inter] font-400 text-[var(--colors-text-text-secondary)]">{{
                $t('备份邮箱以接收恢复码。') }}</div>
            </div>
            <RxSvgIcon name="base/rx_ic_recovery_email" size="100" color="var(--colors-icon-icon-secondary)" />
            <div class="flex justify-end w-full">
              <RxButton :label="$t('选择')" severity="secondary" outlined @click="chooseRecovery('email')" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 步骤三 -->
    <template v-if="currentSetp === '3'">
      <!-- 使用代码恢复 -->
      <template v-if="recoveryType === 'codes'">
        <RecoveryCodes />
      </template>
      <!-- 使用备用邮箱恢复 -->
      <template v-if="recoveryType === 'email'">
        <RecoveryEmail />
      </template>
    </template>

    <template #footer>
      <div class="w-full flex flex-col gap-12px">
        <RxButton v-if="currentSetp !== '2'" :label="$t('下一步')" severity="primary" class="w-full" @click="next" />
        <RxButton v-if="currentSetp === '3'" :label="$t('返回上一步')" severity="secondary" class="w-full" @click="prev"
          outlined />
      </div>
    </template>
  </Dialog>
</template>
