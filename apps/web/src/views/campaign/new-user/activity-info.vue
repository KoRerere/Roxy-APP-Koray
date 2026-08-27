<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useThemeStore } from '/@/stores/theme'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { enhanceCountdown } from '/@/utils'

/** 是否展示静态 IP 低价文案；续费弹窗只需窗口买赠 */
const { showProxyPrice = true } = defineProps<{
  showProxyPrice?: boolean
}>()

const { isDarkTheme } = storeToRefs(useThemeStore())
const { visible, expireAt, datacenterPriceText, residentialPriceText, windowGiftMonths3 } = storeToRefs(useNewUserBenefitStore())
const { fetchBenefit } = useNewUserBenefitStore()

const countdown = ref<ReturnType<typeof enhanceCountdown>>()
/** 设计稿格式：6 天 23:46:21 */
const countdownText = ref('')

const imageSrc = computed(() => {
  return isDarkTheme.value
    ? `url('${getImage('campaing/new-user/new-user-card-dark.svg')}')`
    : `url('${getImage('campaing/new-user/new-user-card-light.svg')}')`
})

watch([visible, expireAt], () => {
  if (visible.value)
    startCountdown()
  else
    stopCountdown()
}, { immediate: true })

onMounted(() => {
  void fetchBenefit()
})

onBeforeUnmount(() => {
  stopCountdown()
})

/** 时分秒补零，对齐设计稿 23:46:21 */
function pad(value: number) {
  return value.toString().padStart(2, '0')
}

/** 对准注册窗口结束时间，到期后刷新资格以隐藏卡片 */
function startCountdown() {
  stopCountdown()
  if (!visible.value || expireAt.value <= Date.now())
    return

  countdown.value = enhanceCountdown(expireAt.value, (date) => {
    const clock = `${pad(date.hours)}:${pad(date.minutes)}:${pad(date.seconds)}`
    countdownText.value = `${date.days} ${$t('天')} ${clock}`
  }, {
    alwaysSecondLevel: true,
    onEnd: () => {
      countdownText.value = ''
      void fetchBenefit()
    },
  })
}

/** 卸载或隐藏时停掉倒计时，避免后台仍刷新文案 */
function stopCountdown() {
  countdown.value?.stop()
  countdown.value = undefined
}
</script>

<template>
  <div v-if="visible" class="flex flex-col justify-center gap-1 px-4 py-3 rounded-1.5 content">
    <i18n-t class="tt-primary text-6 font-700 leading-9" tag="div" scope="global" :keypath="$t('{bonus}福利', { bonus: '{bonus}' })">
      <template #bonus>
        <span class="color-[#FF8A00]">{{ $t('新人专享') }}</span>
      </template>
    </i18n-t>
    <div class="flex flex-col ">
      <i18n-t v-if="showProxyPrice" class="tt-primary text-4 font-500 leading-normal" tag="div" scope="global"
              :keypath="$t('静态机房 IP 低至 {dc}, 静态住宅 IP 低至 {isp}, 不限流量', { dc: '{dc}', isp: '{isp}' })"
      >
        <template #dc>
          <span class="font-700 color-[#FF8A00]">{{ datacenterPriceText }}</span>
        </template>
        <template #isp>
          <span class="font-700 color-[#FF8A00]">{{ residentialPriceText }}</span>
        </template>
      </i18n-t>
      <i18n-t class="tt-primary text-4 font-500 leading-normal" tag="div" scope="global" :keypath="$t('窗口订阅买 {value} 个月送 {gift} 个月', { value: '{value}', gift: '{gift}' })">
        <template #value>
          <span class="font-700 color-[#FF8A00]">3</span>
        </template>
        <template #gift>
          <span class="font-700 color-[#FF8A00]">{{ windowGiftMonths3 }}</span>
        </template>
      </i18n-t>
    </div>
    <div v-if="countdownText" class="pt-1 text-3.5 font-500 leading-normal tt-tertiary">
      {{ $t('福利结束倒计时') }}：{{ countdownText }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  background-image: v-bind(imageSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: right bottom;
}
</style>
