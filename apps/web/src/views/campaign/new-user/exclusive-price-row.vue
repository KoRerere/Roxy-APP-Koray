<script setup lang="ts">
import currency from 'currency.js'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { enhanceCountdown } from '/@/utils'

const { value, diffValue = 0, kind = 'residential', offerActive } = defineProps<{
  /** 应付金额文案 */
  value: string
  /** 相对原价立省金额，大于 0 才展示 */
  diffValue?: number
  /** 当前结算对应的福利类型；any 表示任意一款剩余即可 */
  kind?: 'datacenter' | 'residential' | 'any'
  /** 父级已算好是否走新人价签；不传则按活动+剩余额度 */
  offerActive?: boolean
}>()

const { visible, expireAt, benefit } = storeToRefs(useNewUserBenefitStore())
const { fetchBenefit } = useNewUserBenefitStore()

const countdown = ref<ReturnType<typeof enhanceCountdown>>()
const countdownText = ref('')

/** 当前结算项是否享受新人福利价签 */
const isNewUserOffer = computed(() => {
  if (offerActive === false)
    return false
  if (offerActive === true)
    return true
  if (!visible.value)
    return false
  if (kind === 'any')
    return true
  return benefit.value.remaining[kind]
})

const title = computed(() => isNewUserOffer.value ? $t('Roxy 新人专享') : $t('Roxy 独家特惠'))

onMounted(() => {
  void fetchBenefit()
})

watch([isNewUserOffer, expireAt], () => {
  if (isNewUserOffer.value)
    startCountdown()
  else
    stopCountdown()
}, { immediate: true })

onBeforeUnmount(() => {
  stopCountdown()
})

/** 时分秒补零，对齐设计稿 23:32:21 */
function pad(num: number) {
  return num.toString().padStart(2, '0')
}

/** 对准注册窗口结束时间；到期刷新资格，价签退回独家特惠 */
function startCountdown() {
  stopCountdown()
  if (!isNewUserOffer.value || expireAt.value <= Date.now())
    return

  countdown.value = enhanceCountdown(expireAt.value, (date) => {
    const clock = `${pad(date.hours)}:${pad(date.minutes)}:${pad(date.seconds)}`
    countdownText.value = date.days > 0 ? `${date.days} ${$t('天')} ${clock}` : clock
  }, {
    alwaysSecondLevel: true,
    onEnd: () => {
      countdownText.value = ''
      void fetchBenefit()
    },
  })
}

/** 卸载或退出新人价签时停掉倒计时 */
function stopCountdown() {
  countdown.value?.stop()
  countdown.value = undefined
  countdownText.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex justify-between items-center">
      <div class="details-label" :class="{ 'is-new-user': isNewUserOffer }">
        {{ title }}
      </div>
      <div>
        <div class="details-price" :class="{ 'is-new-user': isNewUserOffer }">
          {{ value }}
        </div>
        <div v-if="diffValue > 0" class="details-diffprice">
          {{ $t('立省 {value}', { value: currency(diffValue).format() }) }}
        </div>
      </div>
    </div>
    <div v-if="isNewUserOffer && countdownText" class="details-countdown">
      {{ $t('新人专享活动剩余：{time}', { time: countdownText }) }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.details-label {
  font-family: 'DingTalk JinBuTi';
  font-size: 15px;
  line-height: 16px;
  background: linear-gradient(90deg, #11a3fd 0%, #f047ff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;

  &.is-new-user {
    background: linear-gradient(73deg, #03c1d9 0%, #57da48 107.49%);
    background-clip: text;
    -webkit-background-clip: text;
  }
}

.details-price {
  color: #12a3fc;
  text-align: right;
  font-size: 24px;
  font-weight: 600;
  line-height: normal;

  &.is-new-user {
    color: transparent;
    background: linear-gradient(84deg, #03c1d9 0%, #57da48 107.49%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.details-diffprice {
  color: var(--primitives-yellow-500);
  text-align: right;
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
}

.details-countdown {
  color: var(--colors-text-text-warning, #fd9f12);
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
}
</style>
