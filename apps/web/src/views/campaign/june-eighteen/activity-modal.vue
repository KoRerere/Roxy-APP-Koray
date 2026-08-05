<script setup lang="ts">
import currency from 'currency.js'
import { format } from 'date-fns'
import { useCampaignStore } from '/@/stores/campaign'
import { enhanceCountdown, getImage } from '/@/utils'

const emit = defineEmits(['close', 'confirm'])

const { currentActivity, maxBonus } = storeToRefs(useCampaignStore())
const { getActivityTotalRecharge } = useCampaignStore()

const countdown = ref()
const countdownData = ref()

/** 剩余不足 5 天时切换为倒计时布局 */
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

const imageSrc = computed(() => {
  return getImage(`campaing/june-eighteen/banner.png`)
})

const showCountdown = computed(() => {
  const remaining = currentActivity.value.end_timestamp - Date.now()
  return remaining > 0 && remaining < FIVE_DAYS_MS
})

const topUpSeasonText = computed(() => {
  return currentActivity.value.recharge_benefits.map((item, index, array) => {
    const next = array[index + 1]
    if (!next)
      return $t('充值 {amount} 及以上送 {percentage}', { amount: currency(item.amount, { precision: 0 }).format(), percentage: `${item.discount}%` })

    return $t('充值 {start} - {end} 送 {percentage}', { start: currency(item.amount, { precision: 0 }).format(), end: currency(next.amount, { precision: 0 }).subtract(1).format(), percentage: `${item.discount}%` })
  }).join('\n')
})

onMounted(() => {
  if (showCountdown.value)
    initCountdown()
})

onBeforeUnmount(() => {
  countdown.value?.stop()
})

function initCountdown() {
  countdown.value = enhanceCountdown(currentActivity.value.end_timestamp, (date) => {
    const { days, hours, minutes, seconds } = date
    countdownData.value = [
      { label: $t('天'), value: days.toString().padStart(2, '0') },
      { label: $t('时'), value: hours.toString().padStart(2, '0') },
      { label: $t('分'), value: minutes.toString().padStart(2, '0') },
      { label: $t('秒'), value: seconds.toString().padStart(2, '0') },
    ].slice(days > 0 ? 0 : 1)
  }, {
    alwaysSecondLevel: true,
    onEnd: () => {
      emit('close')
    },
  })
}

function formatAmount(amount: number) {
  return currency(amount, { precision: 0 }).format()
}

function onConfirm() {
  emit('confirm')
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-1.5 select-none">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="$emit('close')" />
    <div class="relative cursor-pointer" @click="onConfirm">
      <img draggable="false" class="block w-160 rounded-5" :src="imageSrc">
      <div class="absolute inset-0 flex flex-col items-start pa-6">
        <div class="flex w-full justify-between items-center">
          <AnimationBorder :gradient="['#FFE766', '#FFE766', '#FF8F66']" :animation="false" :deg="110" :border-width="1" :border-radius="100">
            <div class="flex items-center py-1.5 px-4 gap-1.5 rounded-full top">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M9.99967 2.5C9.44412 4.72222 8.33301 6.52778 6.66634 7.91667C4.99967 9.30556 4.16634 10.8333 4.16634 12.5C4.16634 14.0471 4.78092 15.5308 5.87488 16.6248C6.96885 17.7188 8.45258 18.3333 9.99967 18.3333C11.5468 18.3333 13.0305 17.7188 14.1245 16.6248C15.2184 15.5308 15.833 14.0471 15.833 12.5C15.833 11.5985 15.5406 10.7212 14.9997 10C14.9997 10.5525 14.7802 11.0824 14.3895 11.4731C13.9988 11.8638 13.4689 12.0833 12.9163 12.0833C12.3638 12.0833 11.8339 11.8638 11.4432 11.4731C11.0525 11.0824 10.833 10.5525 10.833 10C10.833 8.33333 12.083 7.5 12.083 5.83333C12.083 4.72222 11.3886 3.61111 9.99967 2.5Z"
                  fill="url(#paint0_linear_11848_83998)"
                />
                <defs>
                  <linearGradient id="paint0_linear_11848_83998" x1="15.9998" y1="17" x2="15.6792" y2="6.74787" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#FF7D00" />
                    <stop offset="1" stop-color="#FFE766" />
                  </linearGradient>
                </defs>
              </svg>
              <span class="text-3 font-600 top-text">{{ $t('Roxy 充值福利限时加码') }}</span>
            </div>
          </AnimationBorder>
          <div class="color-[#34393D] text-3">
            {{ format(currentActivity.start_timestamp, 'yyyy.MM.dd') }} - {{ format(currentActivity.end_timestamp, 'yyyy.MM.dd') }}
          </div>
        </div>

        <div class="flex flex-col gap-2 text-9 font-700 leading-11 font-[Archivo] color-[#111213] mt-3.5">
          <div>{{ $t('Roxy 充值福利月') }}</div>
          <i18n-t tag="div" scope="global" :keypath="$t('单笔充值最高 {bonus}', { bonus: '{bonus}' })">
            <template #bonus>
              <span class="text-11 font-400 font-[DingTalk_JinBuTi] color-[#FF7D00]">{{ $t('赠送 {value}', { value: `${maxBonus}%` }) }}</span>
            </template>
          </i18n-t>
        </div>

        <template v-if="showCountdown">
          <div class="flex flex-col mt-4">
            <i18n-t tag="div" scope="global" class="text-5 color-[#111213] font-500 leading-7.5 whitespace-pre-wrap"
                    :keypath="$t('充 {start} 起享赠送，充 {amount} 得 {value}', { start: formatAmount(50), amount: formatAmount(100), value: '{value}' })"
            >
              <template #value>
                <span class="font-bold color-[#FF7D00]">{{ formatAmount(getActivityTotalRecharge(100)) }}</span>
              </template>
            </i18n-t>
          </div>
          <div class="flex flex-col gap-2 mt-4">
            <div class="text-3.25 color-[#111213] leading-normal">
              {{ $t('活动结束倒计时') }}
            </div>
            <div class="flex items-start gap-3.5">
              <template v-for="(item, index) in countdownData" :key="item.label">
                <div v-if="index !== 0" class="h-14.5 flex items-center justify-center color-[#111213] text-8">
                  :
                </div>
                <div class="flex flex-col items-center gap-2">
                  <AnimationBorder :gradient="['rgba(17, 163, 253, 0.80)', 'rgba(17, 163, 253, 0.80)', 'rgba(17, 163, 253, 0.80)']" :animation="false" :deg="110" :border-width="1" :border-radius="8">
                    <div class="w-14.5 h-14.5 flex items-center rounded-2 justify-center text-[#11A3FD] text-7.5 leading-9 font-[JetBrains_Mono] bg-white">
                      {{ item.value }}
                    </div>
                  </AnimationBorder>

                  <div class="text-2.75 color-[#111213]/70 leading-normal">
                    {{ item.label }}
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="mt-1.5 text-4 color-[#575D60] font-500 leading-normal">
            {{ $t('活动期间多充多送，新老用户均可参与') }}
          </div>
          <div class="flex flex-col mt-4.5">
            <i18n-t tag="div" scope="global" class="text-5 color-[#111213] font-500 leading-7.5 whitespace-pre-wrap"
                    :keypath="$t('充 {start} 起享赠送，充 {amount} 得 {value}', { start: formatAmount(50), amount: formatAmount(100), value: '{value}' })"
            >
              <template #value>
                <span class="font-bold color-[#FF7D00]">{{ formatAmount(getActivityTotalRecharge(100)) }}</span>
              </template>
            </i18n-t>

            <i18n-t tag="div" scope="global" class="text-5 color-[#111213] font-500 leading-7.5 whitespace-pre-wrap"
                    :keypath="$t('充 {amount} 得 {value}', { amount: formatAmount(1000), value: '{value}' })"
            >
              <template #value>
                <span class="font-bold color-[#FF7D00]">{{ formatAmount(getActivityTotalRecharge(1000)) }}</span>
              </template>
            </i18n-t>
          </div>
        </template>

        <div class="!absolute left-6 bottom-6 flex items-center gap-5">
          <RxButton class="flex-row-reverse !border-none " size="lg" icon="base/rx_ic_chevron_right" :label="$t('立即充值')" />
          <RxTooltip>
            <template #default>
              <div class="flex items-center gap-1 color-[#111213] opacity-80 cursor-pointer">
                <SvgIcon name="base/rx_ic_info" color="#7D8387" />
                <span class="text-3 leading-4">{{ $t('活动详情') }}</span>
              </div>
            </template>
            <template #content>
              <div class="text-white/80 max-w-80 text-3">
                {{ topUpSeasonText }}
              </div>
            </template>
          </RxTooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.top {
  background: linear-gradient(92deg, #fff7cc -0.26%, #ffdacc 99.74%);
  backdrop-filter: blur(16px);

  &-text {
    color: #ff7d00;
  }
}
</style>
