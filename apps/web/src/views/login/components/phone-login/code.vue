<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'

import { API } from '/@/api'
import { enhanceCountdown } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'

defineOptions({ inheritAttrs: false })

const { phone } = defineProps<{
  phone: string
}>()

const [showToast] = useResponseToast()

const modelValue = defineModel<string>()
const isRegistered = defineModel<boolean>('isRegistered')
const showInviteCodeInput = defineModel<boolean>('showInviteCodeInput', { default: false })

const showTips = ref(false)
const lock = ref(false)
const seconds = ref(0)
const countdown = ref()

const btnText = computed(() => {
  return lock.value ? $t('{seconds}s 后重新获取', { seconds: seconds.value.toString().padStart(2, '0') }) : $t('获取验证码')
})

onBeforeUnmount(() => {
  countdown.value?.stop()
})

watch(
  () => phone,
  () => {
    isRegistered.value = undefined
    showInviteCodeInput.value = false
  },
)

async function getCode() {
  if (lock.value)
    return

  const { code, data, msg } = await API.base.sendPhoneVerCodeCreate({ phone })
  showToast(code, msg)
  if (code !== 0)
    return

  isRegistered.value = data.isRegistered
  // 接口确认新用户后自动展开（已展开则不变）
  if (data.isRegistered === false && !showInviteCodeInput.value)
    showInviteCodeInput.value = true

  lock.value = true
  showTips.value = true
  countdown.value = enhanceCountdown(new Date(Date.now() + 60 * 1000), (countdownData) => {
    seconds.value = countdownData.seconds
  }, { onEnd: () => { lock.value = false } })
}
</script>

<template>
  <div>
    <div class="relative">
      <TsFormInputText v-model="modelValue" v-bind="$attrs" />
      <RxButton class="!absolute position-y-center right-2.5" :severity="lock ? 'secondary' : ''" size="xxs" variant="text" :disabled="lock" :label="btnText" @click="getCode" />
    </div>
    <i18n-t v-if="showTips" class="pt-2 text-right terms" tag="div" scope="global" :keypath="$t('未收到验证码？请检查是否在垃圾短信中')" />
  </div>
</template>

<style lang="scss" scoped>
.terms {
  color: var(--colors-text-text-tertiary, #575d60);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  &-link {
    color: var(--colors-text-text-brand, #12a3fc);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
