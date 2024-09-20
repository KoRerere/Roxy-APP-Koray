<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { useLoginContext } from '../hooks/useLoginContext'
import { formSchemas } from './schemas'
import { API } from '/@/api'
import { RxForm } from '/@/components/rx-form'

const signFormData = defineModel({ type: Object, default: {} })

const { setSignFormData, setCurrentComponent, toSignIn } = useLoginContext()
const toast = useToast()

const rememberMe = ref(false)
const isRegister = ref(false)
const formInstance = useTemplateRef('formInstance')

async function handleSubmit() {
  const formData = await formInstance.value?.submit()
  // const params = getFormData(inputs.value)
  setSignFormData(formData)
  console.log(formData)
  // if sign up, switch to emailCodeInputOtp component
  if (isRegister.value) {
    const { code, msg } = await API.base.sendEmailRegisterVerifyCodeList({ email: formData.user_name })
    if (code === 0) {
      toast.add({ severity: 'success', summary: '邮件发送成功，请注意查收！', life: 5000 })
      setCurrentComponent('emailCodeInputOtp')
    }
    else {
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
    }
  }
  else {
    await toSignIn()
  }
}

function openGoogleAuth2Login() {
  const redirect_url = 'https://www.lumibrowser.com/zh_CN/oauth2_google.html'
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&redirect_uri=${redirect_url}&client_id=663574245714-elgschngb873e831n3d7ul9b6s4a8cvq.apps.googleusercontent.com`
  window.open(url)
}

function switchFormMode(val: boolean) {
  isRegister.value = val
}
</script>

<template>
  <!-- <ry-form class="w-full" :inputs="inputs" /> -->
  <RxForm ref="formInstance" v-model="signFormData" :schemas="formSchemas" :footer="false" layout="vertical" />
  <div v-if="!isRegister" class="remember-me">
    <div class="flex items-center">
      <Checkbox v-model="rememberMe" input-id="remember-me" name="pizza" value="Cheese" />
      <label for="remember-me" class="ml-2"> Remember me </label>
    </div>
    <div class="forget-pwd" @click="setCurrentComponent('resetPassword')">
      Forget password
    </div>
  </div>
  <div class="login-ways">
    <ry-button type="button" class="w-full" label="Search" @click="handleSubmit">
      {{ isRegister ? 'Sign up' : 'Log in' }}
    </ry-button>
    <div class="divider">
      <span class="mx-2">OR</span>
    </div>
    <ry-button class="w-full" outlined @click="openGoogleAuth2Login">
      <img src="/google.svg"> Log in with Google
    </ry-button>
    <div v-if="isRegister" class="signup-tips">
      Already have an account?
      <a class="cursor-pointer" @click="switchFormMode(false)">
        Log in
      </a>
    </div>
    <div v-else class="signup-tips">
      Didn’t have an account?
      <a class="cursor-pointer" @click="switchFormMode(true)">
        Sign up
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
    line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
  }
}

.divider {
  width: 100%;
  display: flex;
  align-items: center;
  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 10px;
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
