<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useLoginContext } from '../hooks/useLoginContext'
import SignCardHeader from './sign-card-header.vue'
import { RxAlert } from '/@/components/rx-alert/'

const props = defineProps({
  type: {
    type: String as PropType<'signUp' | 'resetPassword'>,
    required: true,
  },
  email: {
    type: String,
  },
})

const emit = defineEmits(['ok', 'back'])

const emailCode = defineModel('emailCode', { default: '' })

const { setCurrentComponent, getSignFormData, toSignIn } = useLoginContext()
const toast = useToast()
const countdown = ref(0)
const isShowAlert = ref(false)

const getEmail = computed(() => {
  return props.email || getSignFormData().user_name
})

function toReEnter() {
  if (props.type === 'resetPassword') {
    emit('back')
  }
  else {
    setCurrentComponent('signForm', { type: 'signUp' })
  }
}

function startCountdown() {
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value === 0) {
      clearInterval(timer)
    }
  }, 1000)
}

async function handleSendCode() {
  const method = props.type === 'signUp' ? 'sendEmailRegisterVerifyCodeList' : 'sendEmailForgetVerifyCodeList'
  const { code, msg } = await API.base[method]({ email: getEmail.value })
  if (code === 0) {
    startCountdown()
    toast.add({ severity: 'success', summary: $t('验证码已发送'), detail: $t('请检查您的邮箱。'), life: 2500 })
  }
  else {
    mixpanel.track(props.type, { method: 'email', success: false, error: msg })
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
  }

}

async function handleSubmit() {
  if (emailCode.value.length !== 6) {
    return
  }

  const verifyCodeRes = await API.base.getCheckBindEmailVerCodeList({
    email: getEmail.value,
    ver_code: emailCode.value,
  })

  if (!verifyCodeRes.data) {
    mixpanel.track(props.type, { method: 'email', success: false, error: 'invalid verify code' })
    isShowAlert.value = true
    return
  }

  if (props.type === 'resetPassword') {
    emit('ok', emailCode.value)
    return
  }

  const signFormData = getSignFormData()
  const { code, msg } = await API.base.postBase({
    ...signFormData,
    // 用户名不能包含特殊字符
    user_name: signFormData.user_name.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 20),
    email: signFormData.user_name,
    ver_code: emailCode.value,
  })
  if (code === 0) {
    await toSignIn()
    mixpanel.track('signUp', { method: 'email', success: true })
    emit('ok', emailCode.value)
  }
  else {
    mixpanel.track(props.type, { method: 'email', success: false, error: msg })
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
  }
}

function showLiveChat() {
  LiveChatWidget.call('maximize')
}

onBeforeMount(() => {
  startCountdown()
})
</script>

<template>
  <div class="container">
    <RxAlert v-model:visible="isShowAlert" type="error" :title="$t('无效的验证码')" class="w-full" />
    <RxButton class="back-first" text severity="secondary" icon="base/rx_ic_arrow_left" :label="$t('返回上一步')"
      @click="toReEnter"></RxButton>
    <SignCardHeader :subTitle="$t('请检查您的邮箱')">
      <template #description>
        <div class="description">
          <div class="description-item">{{ $t('我们已经向您的邮箱发送了一个6位数字验证码：') }}</div>
          <div class="email-text">{{ getEmail }} </div>
          <div>{{ $t("验证码将在 5 分钟后过期。") }}</div>
          <div class="description-item mt-[12px]">
            {{ $t('请检查邮件以获取验证码') }}
          </div>
        </div>
      </template>
    </SignCardHeader>
    <InputOtp v-model="emailCode" class="inputotp" :length="6" />
    <RxButton size="md" class="w-full" :disabled="emailCode.length !== 6" @click="handleSubmit">
      {{ type === 'signUp' ? $t('完成注册') : $t('下一步') }}
    </RxButton>
    <Divider class="!my-[-12px]">
      <span class="divider-text">{{ $t('或') }}</span>
    </Divider>
    <RxButton severity="secondary" outlined size="md" class="w-full" :disabled="countdown > 0" @click="handleSendCode">
      {{ countdown > 0 ? $t('{time} 秒后可重新获取', { time: `${countdown}` }) : $t('重新发送') }}
    </RxButton>
    <div class="tips">
      <i18n-t :keypath="$t('无法收到验证码？请{tryAgain}或{contact}。', { tryAgain: '{tryAgain}', contact: '{contact}' })"
        scope="global">
        <template #tryAgain>
          <a class="re-enter-text" @click="toReEnter">{{ $t('重新尝试') }}</a>
        </template>
        <template #contact>
          <a class="re-enter-text" @click="showLiveChat">{{ $t('联系支持人员') }}</a>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-4xl, 24px);
  align-self: stretch;

  .title {
    align-self: stretch;
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 100% */
  }

  .description {
    align-self: stretch;
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);

    .description-item {
      color: var(--colors-text-text-tertiary, #8A9093);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px);
      /* 166.667% */
    }
  }
}

.back-first {
  margin-left: -12px;
}

.inputotp {
  gap: var(--spacing-md, 6px);

  :deep(.p-inputotp-input) {
    display: flex;
    width: 50px;
    height: 60px;
    flex-direction: column;
    justify-content: center;
    flex-shrink: 0;
    color: #000;
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    text-transform: uppercase;
  }
}

.email-text {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-lg, 20px);
  /* 166.667% */
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
}

.tips {
  align-self: stretch;
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 160% */
}

.re-enter-text {
  color: var(--Colors-Text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  text-decoration-line: underline;
  cursor: pointer;
}

.divider-text {
  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}
</style>
