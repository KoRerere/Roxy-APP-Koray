<script setup lang="ts">
import RxToggleSwitch from "/@/components/rx-toggle-switch";
import { RxSvgIcon } from '/@/components/rx-icon'
import { type SetpsRef } from '/@/components/rx-steps'
import QRCode2FA from './qrcode-2fa.vue'
import RecoveryCodes from './recovery-codes.vue'
import RecoveryEmail from './recovery-email.vue'
import VerifyEmail from './verify-email.vue'
import Verify2FA from './verify-2fa.vue'
import { API } from "/@/api";
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'

const props = defineProps<{
  defaultValue: boolean
  onChange?: (val: boolean) => void
  bindCode?: () => void
  bindEmail?: () => void
}>()

const modelValue = defineModel<boolean>('modelValue')
const visibleEmail = ref(false)
const visible2FA = ref(false)
const visibleClose2FA = ref(false)

const [showToast, onlyErrorToast] = useResponseToast()

const emailCode = ref('')

const stepsRef = useTemplateRef<SetpsRef>('stepsRef')
const currentSetp = ref('1')
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

const qrcode = ref()
const secret = ref()
const faCode = ref('')
const close2faCode = ref('')

const recoveryType = ref<'code' | 'email'>();

const recoveryCodes = ref<string[]>([])
const recoveryEmail = reactive({
  email: '',
  emailError: false,
  code: '',
  codeError: false,
})

const prev = () => {
  stepsRef.value?.prev();
}

const handleChange = () => {
  if (!props.defaultValue) {
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
    visibleEmail.value = false;
    const res2 = await API.base.userGetValidatorTokenList();
    onlyErrorToast(res2.code, res2.msg)
    if (res2.code === 0) {
      secret.value = res2.data.secret;
      qrcode.value = res2.data.google_keyuri
      visible2FA.value = true
    };
  }
}

const handleNext = async () => {
  if (currentSetp.value === '1') {
    const res = await API.base.userPersonalVerifyValidatorCodeList({
      code: faCode.value,
    })
    onlyErrorToast(res.code, res.msg)
    if (res.code === 0) {
      stepsRef.value?.next();
    }
    return;
  }
  if (currentSetp.value === '3') {
    const res = await API.base.userValidatorBindCreate({
      recover_type: recoveryType.value,
    })
    onlyErrorToast(res.code, res.msg);
    if (res.code === 0) {
      visible2FA.value = false;
      modelValue.value = true;
      props.onChange?.(true);
      if (recoveryType.value === 'code') {
        props.bindCode?.();
      }
      if (recoveryType.value === 'email') {
        props.bindEmail?.();
      }
    }
  }

  stepsRef.value?.next();
}

const chooseRecovery = async (type: 'code' | 'email') => {
  recoveryType.value = type
  stepsRef.value?.next();
  if (type === 'code') {
    const res = await API.base.userGenerateValidatorRecoverCodeList({
      type: 'add'
    })
    onlyErrorToast(res.code, res.msg)
    if (res.code === 0) {
      recoveryCodes.value = res.data;
    }
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
    props.onChange?.(false);
  }
}

const hideDialog = () => {
  modelValue.value = props.defaultValue;
  visibleEmail.value = false;
  visible2FA.value = false;
  visibleClose2FA.value = false;
}

const sendRecoveryEmailCodeRequest = async () => {

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

  <Dialog class="w-480px" v-model:visible="visible2FA" :header="$t('添加新的双重验证方法')" modal :draggable="false">

    <RxSteps class="px-24px mb-24px" v-model="currentSetp" :steps="steps" ref="stepsRef" />

    <!-- 步骤一 -->
    <template v-if="currentSetp === '1'">
      <QRCode2FA v-model="faCode" v-model:qrcode="qrcode" v-model:secret="secret" />
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
              <RxButton :label="$t('选择')" severity="secondary" outlined @click="chooseRecovery('code')" />
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
      <template v-if="recoveryType === 'code'">
        <RecoveryCodes v-model="recoveryCodes" />
      </template>
      <!-- 使用备用邮箱恢复 -->
      <template v-if="recoveryType === 'email'">
        <RecoveryEmail v-model="recoveryEmail" :sendCodeRequest="sendRecoveryEmailCodeRequest" />
      </template>
    </template>

    <template #footer>
      <div class="w-full flex flex-col gap-12px">
        <RxButton v-if="currentSetp !== '2'" :label="currentSetp === '3' ? $t('确认') : $t('下一步')" severity="primary"
          class="w-full" @click="handleNext" />
        <RxButton v-if="currentSetp === '3'" :label="$t('返回上一步')" severity="secondary" class="w-full" @click="prev"
          outlined />
      </div>
    </template>
    <template #closeicon>
      <div @click.stop="hideDialog" class="wh-full flex justify-center items-center">
        <RxSvgIcon name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" />
      </div>
    </template>
  </Dialog>

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
