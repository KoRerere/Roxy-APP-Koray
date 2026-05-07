<script lang="tsx" setup>
import { API } from '/@/api'
import { RxForm } from '/@/components/rx-form'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { oauth2LoginMap } from '/@/utils'
import { useLoginContext } from '../hooks/useLoginContext'
import { checkEmailValid, emailValidateLoading, getFormSchemas, getPhoneSchemas } from './schemas'
import SignCardHeader from './sign-card-header.vue'
import { debounce, isBoolean } from 'es-toolkit'
import { useToast } from 'primevue/usetoast'
import { I18nT } from 'vue-i18n'

defineProps({
  type: {
    type: String as PropType<'signUp' | 'signIn'>,
    default: 'signIn',
  },
  inviteDiscountInfo: {
    type: Object as PropType<Recordable>,
    default: () => ({}),
  },
})

const emit = defineEmits(['register'])
const signFormData = defineModel({ type: Object, default: {} })
const { rememberMe, loginWay, userInfo } = storeToRefs(useUserStore())
const { currentLocale } = storeToRefs(useSimpleLocale())
const toast = useToast()
const instance = getCurrentInstance()

const { setSignFormData, setCurrentComponent, toSignIn, toSignInByPhone } = useLoginContext()
const [_, onlyErrorToast] = useResponseToast()

const isZh = currentLocale.value === 'zh-CN'
const lastLoginEmail = userInfo.value.email
const emailLoginMap = ref<Record<string, boolean>>({})

if (lastLoginEmail) {
  emailLoginMap.value[lastLoginEmail] = true
}

const submitLoading = ref(false)
const formSchemas = ref(getFormSchemas())
const formInstance = useTemplateRef('formInstance')
const loginType = ref<'password' | 'phone'>((!isZh || (loginWay.value && loginWay.value !== 'phone')) ? 'password' : 'phone')
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

const isEmailLogin = computed(() => {
  return loginType.value === 'password'
})

const isEmailRegistered = computed(() => {
  return emailLoginMap.value[signFormData.value.user_name] === true
})

const isValidEmail = computed(() => {
  const username = signFormData.value.user_name
  return isEmailLogin.value && emailLoginMap.value[username] !== true && checkEmailValid(username)
})

const checkEmailRegistered = debounce(async () => {
  const username = signFormData.value.user_name
  if (isValidEmail.value) {
    emailValidateLoading.value = true
    const { code, data } = await API.base.checkEmailRegisteredList({ email: username }).finally(() => {
      emailValidateLoading.value = false
    })
    if (code === 0) {
      if (isBoolean(data.is_registered)) {
        emailLoginMap.value[username] = data.is_registered
      }
      formSchemas.value = getFormSchemas(!data.is_registered)
      formInstance.value?.resetSchema(getFormSchemas(!data.is_registered))
      formInstance.value?.clearValidateMessages()
    }
  }
}, 300)

function switchFormMode() {
  const getSchemas = isEmailLogin.value ? getFormSchemas : () => getPhoneSchemas(() => { loginType.value = 'password' })

  const isRegister = !isBoolean(emailLoginMap.value[signFormData.value.user_name])

  formSchemas.value = getSchemas(isRegister)
  formInstance.value?.resetSchema(getSchemas(isRegister))
  // formInstance.value?.resetFields()
  formInstance.value?.clearValidateMessages()
  emit('register', emailLoginMap.value[signFormData.value.user_name] === false)
}

watch([() => signFormData.value.user_name, loginType], () => {
  switchFormMode()
  emailValidateLoading.value = isValidEmail.value
  checkEmailRegistered()
}, { immediate: true })

async function handleSubmit() {
  if (submitLoading.value)
    return
  submitLoading.value = true
  try {
    const formData = await formInstance.value?.submit() as any
    // const params = getFormData(inputs.value)
    setSignFormData(formData)
    console.log(formData)

    // 如果邮箱未注册，发送验证码
    if (isEmailLogin.value && emailLoginMap.value[formData.user_name] === false) {
      const { code, msg } = await API.base.sendEmailRegisterVerifyCodeList({ email: formData.user_name })
      if (code === 0) {
        setCurrentComponent('emailCodeInputOtp')
      }
      else {
        if (code === 103) {
          toast.add({
            severity: 'error',
            summary: $t('邮箱不支持'),
            detail: () => (
              <I18nT keypath={$t('当前邮箱暂不支持注册，请更换常用邮箱后重试。如需帮助，请{tech}。', { tech: '{tech}' })}>
                {{ tech: () =>
                  <span onClick={() => instance?.appContext.config.globalProperties.$showLiveChat()} class="cursor-pointer text-[var(--colors-text-text-brand)]">{$t('联系技术支持')}</span> }}
              </I18nT>
            ),
            life: 2500,
          })
        }
        else {
          onlyErrorToast(-1, msg || $t('发生错误'))
        }
      }
      return
    }

    // 如果邮箱在本机上首次登录，检查是否已注册
    if (isEmailLogin.value && emailLoginMap.value[formData.user_name] === undefined) {
      emailValidateLoading.value = true
      const { code, data, msg } = await API.base.checkEmailRegisteredList({ email: formData.user_name }).finally(() => {
        emailValidateLoading.value = false
      })
      onlyErrorToast(code, msg)
      if (code !== 0) {
        onlyErrorToast(-1, msg || $t('发生错误'))
        return
      }

      if (isBoolean(data.is_registered)) {
        emailLoginMap.value[formData.user_name] = data.is_registered
      }

      formSchemas.value = getFormSchemas(!data.is_registered)
      formInstance.value?.resetSchema(getFormSchemas(!data.is_registered))
      formInstance.value?.clearValidateMessages()
      return
    }
    if (isEmailLogin.value) {
      await toSignIn()
    }
    else {
      await toSignInByPhone()
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
  <I18nT v-if="inviteDiscountInfo && inviteDiscountInfo.isShow" class="w-full px-4 py-2.5 rounded-2 discount" tag="div"
         :keypath="$t('💰 {name} 邀请您注册，消费即可享受 {discount} 折扣', { name: inviteDiscountInfo.userName, discount: '{discount}' })" scope="global"
  >
    <template #discount>
      <span class="discount-value">{{ inviteDiscountInfo.userDiscount }}%</span>
    </template>
  </I18nT>
  <div class="self-stretch flex items-center justify-between">
    <SignCardHeader :title="$t('欢迎使用')" />
    <RxSelectButton v-if="isZh" v-model="loginType" class="shrink-0" :options="loginTypeOptions" size="xxs" option-label="name" option-value="value" data-key="value" />
  </div>
  <RxForm ref="formInstance" v-model="signFormData" :schemas="formSchemas" :colon="false" :footer="false" layout="vertical" @keydown.enter="handleSubmit">
    <template #before-field-password>
      <div v-if="checkEmailValid(signFormData.user_name) && isEmailLogin && !isEmailRegistered && !emailValidateLoading" class="setup-password-tips">
        {{ $t('邮箱尚未注册，请设置您的密码：') }}
      </div>
    </template>
  </RxForm>
  <div v-if="loginType !== 'phone' && isEmailRegistered" class="remember-me">
    <div class="flex items-center text-[12px]">
      <RxCheckbox v-model="rememberMe" input-id="remember-me" :binary="true" />
      <label for="remember-me" class="ml-2"> {{ $t('记住密码') }} </label>
    </div>
    <div class="forget-pwd" @click="setCurrentComponent('resetPassword')">
      {{ $t('忘记密码？') }}
    </div>
  </div>
  <div class="login-ways">
    <RxButton :loading="submitLoading || emailValidateLoading" type="button" size="lg" class="w-full" @click="handleSubmit">
      <template v-if="loginType === 'phone'">
        {{ $t('登录/注册') }}
      </template>
      <template v-else-if="isBoolean(emailLoginMap[signFormData.user_name]) && !emailValidateLoading">
        {{ emailLoginMap[signFormData.user_name] ? $t('登录') : $t('注册') }}
      </template>
      <template v-else>
        {{ $t('登录/注册') }}
      </template>
    </RxButton>
    <div v-if="loginType === 'phone'" class="-mt-1 auto-register">
      {{ $t('新手机号将自动注册 RoxyBrowser 账号') }}
    </div>
    <div class="divider">
      <span class="mx-2">{{ $t('或') }}</span>
    </div>
    <RxButton :label="$t('通过 {value} 账号登录', { value: 'Google' })" class="w-full" severity="secondary" size="md" icon="websites/rx_site_google" @click="oauth2LoginMap.google" />
    <div class="w-full grid grid-cols-3 gap-3">
      <RxButton label="Github" severity="secondary" size="md" icon="websites/rx_site_github" @click="oauth2LoginMap.github" />
      <RxButton label="Facebook" severity="secondary" size="md" icon="websites/rx_site_facebook" @click="oauth2LoginMap.facebook" />
      <RxButton label="VK" severity="secondary" size="md" icon="websites/rx_site_vk" @click="oauth2LoginMap.vk" />
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

.setup-password-tips {
  color: var(--colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;
  margin-bottom: 8px;
}

.discount {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  line-height: 20px;

  background:
    linear-gradient(0deg, var(--colors-background-bg-warning) 0%, var(--colors-background-bg-warning) 100%),
    var(--colors-background-bg-block);

  &-value {
    color: var(--colors-text-text-warning);
    font-family: 'DingTalk JinBuTi', Inter, sans-serif;
    font-size: 14px;
    font-weight: 500;
  }
}
</style>
