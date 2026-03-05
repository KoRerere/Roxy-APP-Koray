<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'

import { API } from '/@/api'
import { enhanceCountdown } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'

defineOptions({ inheritAttrs: false })

const { phone } = defineProps<{
  phone: string,
  tipsClick?: () => void
}>()

const [showToast] = useResponseToast()

const modelValue = defineModel<string>()

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

async function getCode() {
  if (lock.value)
    return

  const { code, msg } = await API.base.sendPhoneVerCodeCreate({ phone })
  showToast(code, msg)
  if (code !== 0)
    return

  lock.value = true
  showTips.value = true
  countdown.value = enhanceCountdown(new Date(Date.now() + 60 * 1000), (data) => {
    seconds.value = data.seconds
  }, { onEnd: () => { lock.value = false } })
}
</script>

<template>
  <div>
    <div class="relative">
      <TsFormInputText v-model="modelValue" v-bind="$attrs" />
      <RxButton class="!absolute position-y-center right-2.5" :severity="lock ? 'secondary' : ''" size="xxs" variant="text" :disabled="lock" :label="btnText" @click="getCode" />
    </div>
    <i18n-t v-if="showTips" class="pt-2 text-right terms" tag="div" scope="global" :keypath="$t('未收到验证码？{link}', { link: '{link}' })" @click="tipsClick">
      <template #link>
        <span class="cursor-pointer terms-link">{{ $t('点击这里，切换到邮箱登录注册') }}</span>
      </template>
    </i18n-t>
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
