<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { enhanceCountdown } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'

defineOptions({ inheritAttrs: false })

const { phone } = defineProps<{
  phone: string
}>()

const [showToast] = useResponseToast()

const modelValue = defineModel<string>()

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
  countdown.value = enhanceCountdown(new Date(Date.now() + 60 * 1000), (data) => {
    seconds.value = data.seconds
  }, { onEnd: () => { lock.value = false } })
}
</script>

<template>
  <div class="relative">
    <TsFormInputText v-model="modelValue" v-bind="$attrs" />
    <RxButton class="!absolute position-y-center right-2.5" :severity="lock ? 'secondary' : ''" size="xxs" variant="text" :disabled="lock" :label="btnText" @click="getCode" />
  </div>
</template>

<style scoped></style>
