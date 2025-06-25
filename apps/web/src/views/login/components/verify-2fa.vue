<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import { $t } from '/@/locales'
import { useLoginContext } from '../hooks/useLoginContext'
import { useThemeStore } from '/@/stores/theme'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

interface Props {
  tempToken: string
  recoverType: 'code' | 'email' | (string & {})
}

const { recoverType, tempToken } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'success', data: any): void
}>()

const themeStore = useThemeStore()
const [_, onlyErrorToast] = useResponseToast()
const { setCurrentComponent, getSignFormData, toSignIn } = useLoginContext()

const isShowAlert = ref(false)
const fa_code = ref('')

const imgSrc = computed(() => new URL(`../../../assets/images/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/rx_illustration_verification.svg`, import.meta.url).href)

async function handleSubmit() {
  const { code, msg } = await API.base.getPersonalVerifyValidatorCodeList({ temp_token: tempToken, code: fa_code.value, type: 'login_2fa' })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    isShowAlert.value = true
    mixpanel.track('login', { method: '2fa', success: false, error: msg })
    return
  }
  getLoginInfoBy2FA()
}

async function getLoginInfoBy2FA() {
  const { code, data, msg } = await API.base.get2FaLoginInfoList({ temp_token: tempToken, type: '2fa_code' })

  onlyErrorToast(code, msg)
  if (code !== 0) return

  emit('success', data)
}
</script>

<template>
  <div class="flex flex-col items-start gap-6">
    <RxAlert v-model:visible="isShowAlert" class="w-full" :title="$t('无效的验证码')" type="error" />
    <RxButton class="-ml-3" text severity="secondary" icon="base/rx_ic_arrow_left" :label="$t('返回上一步')" @click="setCurrentComponent('signForm')"></RxButton>
    <img class="mx-auto w-32" :src="imgSrc"></img>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3">
        <div class="description">Please check your authentication app and enter the one-time password below to continue: </div>
        <InputOtp v-model="fa_code" class="inputotp" :length="6" />
      </div>
      <RxButton size="md" class="w-full" :disabled="fa_code.length !== 6" @click="handleSubmit">{{ $t('登录') }}</RxButton>
      <i18n-t class="description" tag="div" :keypath="$t('无法登录？请{recovery}。', { recovery: '{recovery}' })" scope="global">
        <template #recovery>
          <a v-if="recoverType === 'code'" class="description-link" @click="setCurrentComponent('recoveryCode')">{{ $t('使用恢复代码') }}</a>
          <a v-else class="description-link" @click="setCurrentComponent('recoveryEmail')">{{ $t('使用恢复邮箱') }}</a>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.description {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 19.2px;

  &-link {
    color: var(--colors-text-text-brand);
    cursor: pointer;
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}

.inputotp {
  gap: 6px;

  :deep(.p-inputotp-input) {
    display: flex;
    width: 67px;
    height: 76px;
    flex-direction: column;
    justify-content: center;
    flex-shrink: 0;
    color: var(--colors-text-text-primary);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    text-transform: uppercase;
  }
}
</style>
