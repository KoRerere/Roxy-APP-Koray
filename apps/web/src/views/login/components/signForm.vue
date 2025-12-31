<script lang="ts" setup>
import { API } from '/@/api'
import { RxForm } from '/@/components/rx-form'

import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { oauth2LoginMap } from '/@/utils'
import { useLoginContext } from '../hooks/useLoginContext'
import { getFormSchemas, getPhoneSchemas } from './schemas'
import SignCardHeader from './sign-card-header.vue'

const props = defineProps({
  type: {
    type: String as PropType<'signUp' | 'signIn'>,
    default: 'signIn',
  },
})

const emit = defineEmits(['register'])
const signFormData = defineModel({ type: Object, default: {} })
const { rememberMe, loginWay } = storeToRefs(useUserStore())
const { currentLocale } = storeToRefs(useSimpleLocale())

const { setSignFormData, setCurrentComponent, toSignIn, toSignInByPhone } = useLoginContext()
const [_, onlyErrorToast] = useResponseToast()

const isZh = currentLocale.value === 'zh-CN'

const submitLoading = ref(false)
const formSchemas = ref(getFormSchemas())
const isRegister = ref(props.type === 'signUp')
const formInstance = useTemplateRef('formInstance')
const loginType = ref((!isZh || (loginWay.value && loginWay.value !== 'phone')) ? 'password' : 'phone')
const loginTypeOptions = [
  {
    name: $t('手机号'),
    value: 'phone',
  },
  {
    name: $t('邮箱'),
    value: 'password',
  },
]

watch([isRegister, loginType], ([val]) => {
  switchFormMode(val)
}, { immediate: true, flush: 'post' })

function switchFormMode(val: boolean) {
  const getSchemas = !isRegister.value && loginType.value === 'phone' ? getPhoneSchemas : getFormSchemas
  isRegister.value = val
  formSchemas.value = getSchemas(val)
  formInstance.value?.resetSchema(getSchemas(val))
  // formInstance.value?.resetFields()
  formInstance.value?.clearValidateMessages()
  emit('register', val)
}

async function handleSubmit() {
  if (submitLoading.value)
    return
  submitLoading.value = true
  try {
    const formData = await formInstance.value?.submit() as any
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
        onlyErrorToast(-1, msg || $t('发生错误'))
      }
    }
    else {
      loginType.value === 'phone' ? await toSignInByPhone() : await toSignIn()
    }
  }
  finally {
    submitLoading.value = false
  }
}

defineExpose({
  setSubmitLoading: (val: boolean) => {
    submitLoading.value = val
  },
  clearValidateMessages: () => {
    formInstance.value?.clearValidateMessages()
  },
})
</script>

<template>
  <div class="self-stretch flex items-center justify-between">
    <SignCardHeader :title="isRegister ? $t('创建账号') : $t('登录')" />
    <RxSelectButton v-if="!isRegister && isZh" v-model="loginType" class="shrink-0" :options="loginTypeOptions" size="xxs" option-label="name" option-value="value" data-key="value" />
  </div>
  <RxForm ref="formInstance" v-model="signFormData" :schemas="formSchemas" :colon="false" :footer="false" layout="vertical" @keydown.enter="handleSubmit" />
  <div v-if="!isRegister && loginType !== 'phone'" class="remember-me">
    <div class="flex items-center text-[12px]">
      <RxCheckbox v-model="rememberMe" input-id="remember-me" :binary="true" />
      <label for="remember-me" class="ml-2"> {{ $t('记住登录状态') }} </label>
    </div>
    <div class="forget-pwd" @click="setCurrentComponent('resetPassword')">
      {{ $t('忘记密码？') }}
    </div>
  </div>
  <div class="login-ways">
    <RxButton :loading="submitLoading" type="button" size="lg" class="w-full" @click="handleSubmit">
      {{ isRegister ? $t('注册') : $t('登录') }}
    </RxButton>
    <div v-if="!isRegister && loginType === 'phone'" class="-mt-1 auto-register">
      {{ $t('新手机号将自动注册 RoxyBrowser 账号') }}
    </div>
    <div class="divider">
      <span class="mx-2">{{ $t('或') }}</span>
    </div>
    <RxButton :label="$t('通过 {value} 账号登录', { value: 'Google' })" class="w-full" severity="secondary" size="md" icon="websites/rx_site_google" @click="oauth2LoginMap.google" />
    <RxButton :label="$t('通过 {value} 账号登录', { value: 'Facebook' })" class="w-full" severity="secondary" size="md" icon="websites/rx_site_facebook" @click="oauth2LoginMap.facebook" />
    <RxButton :label="$t('通过 {value} 账号登录', { value: 'GitHub' })" class="w-full" severity="secondary" size="md" icon="websites/rx_site_github" @click="oauth2LoginMap.github" />
    <RxButton :label="$t('通过 {value} 账号登录', { value: 'VK' })" class="w-full" severity="secondary" size="md" icon="websites/rx_site_vk" @click="oauth2LoginMap.vk" />
    <div v-if="isRegister" class="signup-tips">
      {{ $t('已有账号？') }}
      <a class="cursor-pointer" @click="switchFormMode(false)">
        {{ $t('前往登录') }}
      </a>
    </div>
    <div v-else-if="loginType !== 'phone'" class="signup-tips">
      {{ $t("没有RoxyBrowser账户？") }}
      <a class="cursor-pointer" @click="switchFormMode(true)">
        {{ $t('创建账号') }}
      </a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.auto-register {
  color: var(--colors-text-text-tertiary);
  font-family: 'PingFang SC';
  font-size: 12px;
  line-height: 16px;
}

.remember-me {
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;

  .forget-pwd {
    cursor: pointer;
    color: var(--primitives-blue-500, #12a3fc);
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
  color: var(--colors-text-text-primary, #fafafa);
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
  background: var(--colors-border-divider);
}

.login-ways {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;

  :deep(.p-button) {
    box-shadow: none;
  }
}

.signup-tips {
  color: var(--colors-text-text-primary, #fafafa);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
</style>
