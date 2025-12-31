<script setup lang="ts">
import { API } from '/@/api';
import { useResponseToast } from '/@/hooks/useResponseToast';
;
import { useUserStore } from '/@/stores/user';

const { onOk } = defineProps<{
  onOk: (code: string) => any,
}>()

const [showToast, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()

const countdown = ref(0);
const emailCode = ref('');
let timer: any;

async function resetCode() {
  const { code, msg } = await API.base.userWithdrawVerifyCodeList()

  if (code !== 0) {
    onlyErrorToast(code, msg)
    return
  }
  showToast(0, $t('验证码已发送'))
  startCountdown()
}

const startCountdown = () => {
  countdown.value = 60;
  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) {
      clearInterval(timer);
    }
  }, 1000);
}

onMounted(() => {
  startCountdown();
});

onUnmounted(() => {
  clearInterval(timer);
});
</script>

<template>
  <div class="identity-verification">
    <div>{{ $t("我们已经向您的邮箱发送了一个6位数字验证码：") }}</div>
    <div class="official-email"> {{ userStore.userInfo.email }}</div>
    <div class="mt-5">{{ $t('请检查邮件以获取验证码') }}</div>
    <InputOtp v-model="emailCode" :length="6" size="large" class="mt-[16px]" />
    <div class="button-group mt-[16px]">
      <RxButton :label="$t('确认')" :disabled="emailCode.length !== 6" @click="onOk(emailCode)">
      </RxButton>
      <Divider class="!m-0">
        {{ $t('或') }}
      </Divider>
      <RxButton severity="secondary" outlined :disabled="countdown > 0" @click="resetCode">
        {{ countdown ? $t('{time} 秒后可重新获取', { time: countdown }) : $t('重新获取') }}
      </RxButton>
      <div>
        {{ $t('无法收到验证码？请检查您的垃圾邮件或重新发送验证码') }}
      </div>
    </div>
  </div>
</template>


<style scoped lang="scss">
.identity-verification {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-lg, 20px);

  .official-email {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-lg, 20px);
  }

  .button-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2xl, 10px);
    align-self: stretch;

    >* {
      width: 100%;
    }
  }


  :deep(.p-inputotp .p-inputtext) {
    width: 50px;
    height: 60px;
    padding: 10px;
    font-size: 28px;
  }

}
</style>
