<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import { type SetpsRef } from '/@/components/rx-steps'
import { API } from "/@/api";
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import QRCode2FA from './qrcode-2fa.vue'
import RecoveryCodes from './recovery-codes.vue'
import RecoveryEmail from './recovery-email.vue'
import { RecoveryType } from '/@/enums/account'

const props = withDefaults(defineProps<{
  tempToken?: string
  closable?: boolean
  onCancel?: () => void
  onSuccess?: (type: RecoveryType) => void
}>(), {
  closable: true
})

const visible = defineModel<boolean>('visible', { required: true })

const [showToast, onlyErrorToast] = useResponseToast()

const stepsRef = useTemplateRef<SetpsRef>('stepsRef')
const defaultSetp = '1'
const currentSetp = ref(defaultSetp)
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

const qrcode2FA = reactive({
  qrcode: '',
  secret: '',
  code: '',
})

const recoveryType = ref<RecoveryType>();

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

const handleNext = async () => {
  if (currentSetp.value === '1') {
    const res = await API.base.getPersonalVerifyValidatorCodeList({
      code: qrcode2FA.code,
      temp_token: props.tempToken,
      type: props.tempToken ? 'login_recover_code' : 'add_2fa_info'
    })
    onlyErrorToast(res.code, res.msg)
    if (res.code === 0) {
      stepsRef.value?.next();
    }
    return;
  }
  if (currentSetp.value === '3') {
    const res = await API.base.validatorBindCreate({
      recover_type: recoveryType.value as string,
      recover_email: recoveryEmail.email,
      ver_code: recoveryEmail.code.trim(),
      temp_token: props.tempToken
    })
    onlyErrorToast(res.code, res.msg);
    if (res.code === 0) {
      props.onSuccess?.(recoveryType.value as RecoveryType);
      resetStatus();
    }
  }

  stepsRef.value?.next();
}

const chooseRecovery = async (type: RecoveryType) => {
  recoveryType.value = type
  stepsRef.value?.next();
  if (type === RecoveryType.Code) {
    const res = await API.base.generateValidatorRecoverCodeList({
      type: 'add',
      temp_token: props.tempToken
    })
    onlyErrorToast(res.code, res.msg)
    if (res.code === 0) {
      recoveryCodes.value = res.data;
    }
  }
}

const resetStatus = () => {
  visible.value = false;
  currentSetp.value = defaultSetp;
  qrcode2FA.qrcode = '';
  qrcode2FA.secret = '';
  qrcode2FA.code = '';
  recoveryType.value = undefined
  recoveryEmail.email = ''
  recoveryEmail.code = ''
}

const hideDialog = () => {
  props.onCancel?.();
  resetStatus();
}

const sendRecoveryEmailCodeRequest = async () => {
  if (recoveryEmail.email) {
    const res = await API.base.sendValidatorEmailVerifyCodeList({
      email: recoveryEmail.email,
      type: 'add',
      temp_token: props.tempToken
    })
    onlyErrorToast(res.code, res.msg)
    if (res.code === 0) {
      showToast(0, $t('验证码已发送'))
    }
    return res;
  }
}

watchEffect(async () => {
  if (visible.value) {
    const res2 = await API.base.getValidatorTokenInfoList({ temp_token: props.tempToken });
    onlyErrorToast(res2.code, res2.msg)
    if (res2.code === 0) {
      qrcode2FA.secret = res2.data.secret;
      qrcode2FA.qrcode = res2.data.google_keyuri
    };
  }
})
</script>

<template>
  <Dialog class="w-480px" v-model:visible="visible" :header="$t('添加新的双重验证方法')" modal :draggable="false"
    :closable="closable">
    <RxSteps class="px-24px mb-24px" v-model="currentSetp" :steps="steps" ref="stepsRef" />

    <!-- 步骤一 -->
    <template v-if="currentSetp === '1'">
      <QRCode2FA v-model="qrcode2FA" />
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
            class="flex-1 flex flex-col items-center justify-between border-1 border-solid border-[var(--colors-border-border-subtle)] rounded-8px px-16px py-12px bg-[var(--colors-background-bg-example)]">
            <div class="flex flex-col gap-2px w-full">
              <div class="text-14px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('恢复代码') }}</div>
              <div class="text-12px font-[Inter] font-400 text-[var(--colors-text-text-secondary)]">{{
                $t('保存一组可用作双重身份验证的恢复代码') }}</div>
            </div>
            <div class="w-full flex flex-col items-center">
              <RxSvgIcon name="base/rx_ic_recovery_codes" size="100" color="var(--colors-icon-icon-example)" />
              <div class="flex justify-end w-full">
                <RxButton :label="$t('选择')" severity="secondary" outlined @click="chooseRecovery(RecoveryType.Code)" />
              </div>
            </div>
          </div>

          <div
            class="flex-1 flex flex-col items-center justify-between border-1 border-solid border-[var(--colors-border-border-subtle)] rounded-8px px-16px py-12px bg-[var(--colors-background-bg-example)]">
            <div class="flex flex-col gap-2px w-full">
              <div class="text-14px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('恢复邮箱') }}</div>
              <div class="text-12px font-[Inter] font-400 text-[var(--colors-text-text-secondary)]">{{
                $t('备份邮箱以接收恢复码。') }}</div>
            </div>
            <div class="w-full flex flex-col items-center">
              <RxSvgIcon name="base/rx_ic_recovery_email" size="100" color="var(--colors-icon-icon-example)" />
              <div class="flex justify-end w-full">
                <RxButton :label="$t('选择')" severity="secondary" outlined @click="chooseRecovery(RecoveryType.Email)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 步骤三 -->
    <template v-if="currentSetp === '3'">
      <!-- 使用代码恢复 -->
      <template v-if="recoveryType === RecoveryType.Code">
        <RecoveryCodes v-model="recoveryCodes" />
      </template>
      <!-- 使用备用邮箱恢复 -->
      <template v-if="recoveryType === RecoveryType.Email">
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
</template>