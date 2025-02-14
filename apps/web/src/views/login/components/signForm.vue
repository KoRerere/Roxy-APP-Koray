<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { RxForm } from '/@/components/rx-form'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { isDev } from '/@/utils'
import { useLoginContext } from '../hooks/useLoginContext'
import { getFormSchemas } from './schemas'
import SignCardHeader from './sign-card-header.vue'

const props = defineProps({
  type: {
    type: String as PropType<'signUp' | 'signIn'>,
    default: 'signIn',
  },
})

const signFormData = defineModel({ type: Object, default: {} })
const { rememberMe } = storeToRefs(useUserStore())

const { setSignFormData, setCurrentComponent, toSignIn } = useLoginContext()
const toast = useToast()

const submitLoading = ref(false)
const formSchemas = ref(getFormSchemas())
const isRegister = ref(props.type === 'signUp')
const formInstance = useTemplateRef('formInstance')

async function handleSubmit() {
  submitLoading.value = true
  try {
    const formData = await formInstance.value?.submit()
    // const params = getFormData(inputs.value)
    setSignFormData(formData)
    console.log(formData)
    // if sign up, switch to emailCodeInputOtp component
    if (isRegister.value) {
      const { code, msg } = await API.base.sendEmailRegisterVerifyCodeList({ email: formData.user_name })
      if (code === 0) {
        setCurrentComponent('emailCodeInputOtp')
      }
      else {
        mixpanel.track('signUp', { method: 'email', success: false, error: msg })
        toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 2500 })
      }
    }
    else {
      await toSignIn()
    }
  }
  finally {
    submitLoading.value = false
  }
}

function openGoogleAuth2Login() {
  const redirect_url = `https://roxybrowser.com/${isDev ? 'dev-' : ''}auth?source=google`
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&redirect_uri=${redirect_url}&client_id=663574245714-elgschngb873e831n3d7ul9b6s4a8cvq.apps.googleusercontent.com`
  window.open(url)
}

function openGithubAuth2Login() {
  const redirect_url = `https://roxybrowser.com/${isDev ? 'dev-' : ''}auth?source=github`
  const client_id = isDev ? 'Ov23lidZHwoteYPc2Bbv' : 'Ov23li2tP2jopYhz3S0A'
  const url = `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=user:email&redirect_uri=${redirect_url}`
  window.open(url)
}

function switchFormMode(val: boolean) {
  isRegister.value = val
  formSchemas.value = getFormSchemas(val)
  formInstance.value?.updateSchema(getFormSchemas(val))
  formInstance.value?.clearValidateMessages()
}
</script>

<template>
  <SignCardHeader :title="isRegister ? $t('创建账号') : $t('登录')"
    :description="isRegister ? $t('创建账号以体验 Roxy 提供的服务') : $t('登录账号以体验 Roxy 提供的服务')" />
  <RxForm ref="formInstance" v-model="signFormData" :schemas="formSchemas" :colon="false" :footer="false"
    layout="vertical" @keydown.enter="handleSubmit" />
  <div v-if="!isRegister" class="remember-me">
    <div class="flex items-center text-[12px]">
      <Checkbox v-model="rememberMe" input-id="remember-me" :binary="true" />
      <label for="remember-me" class="ml-2"> {{ $t('记住登录状态') }} </label>
    </div>
    <div class="forget-pwd" @click="setCurrentComponent('resetPassword')">
      {{ $t('忘记密码？') }}
    </div>
  </div>
  <div class="login-ways">
    <RxButton :loading="submitLoading" type="button" size="md" class="w-full" @click="handleSubmit">
      {{ isRegister ? $t('注册') : $t('登录') }}
    </RxButton>
    <div class="divider">
      <span class="mx-2">{{ $t('或') }}</span>
    </div>
    <RxButton class="w-full" outlined severity="secondary" size="md" @click="openGoogleAuth2Login">
      <SvgIcon name="websites/rx_site_google" /> {{ $t('通过 Google 账号登录') }}
    </RxButton>
    <RxButton class="w-full" outlined severity="secondary" size="md" @click="openGithubAuth2Login">
      <SvgIcon name="websites/rx_site_github" /> {{ $t('通过 Github 账号登录') }}
    </RxButton>
    <div v-if="isRegister" class="signup-tips">
      {{ $t('已有账号？') }}
      <a class="cursor-pointer" @click="switchFormMode(false)">
        {{ $t('前往登录') }}
      </a>
    </div>
    <div v-else class="signup-tips">
      {{ $t("没有RoxyBrowser账户？") }}
      <a class="cursor-pointer" @click="switchFormMode(true)">
        {{ $t('创建账号') }}
      </a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.remember-me {
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;

  .forget-pwd {
    cursor: pointer;
    color: var(--Color-blue-300, #12a3fc);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }

  :deep(.p-checkbox) {
    width: 16px;
    height: 16px;
  }

  :deep(.p-checkbox-box) {
    width: 16px;
    height: 16px;
  }
}

.divider {
  width: 100%;
  display: flex;
  align-items: center;
  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

.divider::before,
.divider::after {
  flex: 1;
  content: '';
  height: 1px;
  background: var(--Colors-Border-border-container, #c7cdd1);
}

.login-ways {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;
}

.signup-tips {
  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
</style>
