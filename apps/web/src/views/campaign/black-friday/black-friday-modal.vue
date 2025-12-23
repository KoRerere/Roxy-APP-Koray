<script setup lang="ts">
import { $t } from '/@/locales'
import { format } from 'date-fns'
import { useCampaignStore } from '/@/stores/campaign'
import { useSimpleLocale } from '/@/stores/locale'
import { enhanceCountdown } from '/@/utils/basic'

const emit = defineEmits(['close', 'confirm'])

const { blackFridayInfo } = storeToRefs(useCampaignStore())
const { currentLocale } = storeToRefs(useSimpleLocale())

const stopCountdown = ref()
const countdown = ref()

const imageUrls = computed(() => ({
  cover: `/images/campaing/black-friday/modal-${currentLocale.value}.svg`,
  badge: `/images/campaing/black-friday/badge-${currentLocale.value}.svg`,
}))

const lessThan24Hours = computed(() => {
  return (blackFridayInfo.value!.end_timestamp - Date.now()) < 24 * 60 * 60 * 1000
})

const lessThan72Hours = computed(() => {
  return (blackFridayInfo.value!.end_timestamp - Date.now()) < 72 * 60 * 60 * 1000
})

const countdownFormat = computed(() => {
  if (!countdown.value || !lessThan72Hours.value)
    return {}

  const { days, hours, minutes, seconds } = countdown.value

  if (lessThan24Hours.value) {
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0'),
    }
  }

  return {
    hours: (days * 24 + hours).toString().padStart(2, '0'),
    minutes: minutes.toString().padStart(2, '0'),
  }
})

onBeforeMount(() => {
  stratCountdown()
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

function stratCountdown() {
  stopCountdown.value = enhanceCountdown(blackFridayInfo.value!.end_timestamp, (time) => {
    countdown.value = time
  }, { alwaysSecondLevel: lessThan24Hours.value, lessThan24Interval: 0.01 })
}

function onSubscribe() {
  emit('confirm')
  onClose()
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="onClose" />
    <div v-if="lessThan72Hours" class="relative">
      <img src="/images/campaing/black-friday/modal-bg.svg" class="absolute block w-full rounded-5">
      <div class="relative min-w-140 flex flex-col gap-12 pa-6 text-white z-1">
        <div class="flex items-center justify-between deal-head">
          <div><span class="deal-title">RoxyBrowser</span> {{ $t('超级优惠') }}</div>
          <div>{{ format(new Date(blackFridayInfo!.start_timestamp), 'yyyy/MM/dd') }} - {{ format(new Date(blackFridayInfo!.end_timestamp), 'yyyy/MM/dd') }}</div>
        </div>
        <div v-if="countdown" class="flex-1 text-center">
          <div class="deal-text">
            {{ $t('黑色星期五折扣剩余') }}
          </div>
          <div v-if="lessThan24Hours" class="deal-time">
            {{ countdownFormat.hours }}:{{ countdownFormat.minutes }}:{{ countdownFormat.seconds }}
          </div>
          <div v-else class="flex items-baseline justify-center deal-time">
            <span>{{ countdownFormat.hours }}</span>
            <span class="deal-unit">&nbsp;{{ $t('小时') }}&nbsp;</span>
            <span>{{ countdownFormat.minutes }}</span>
            <span class="deal-unit">&nbsp;{{ $t('分钟') }}</span>
          </div>
          <div class="deal-desc">
            {{ $t('3折优惠再赠送12个月') }}
          </div>
        </div>
        <RxButton class="self-center shrink-0" size="lg" severity="secondary" @click="onSubscribe">
          <div class="flex items-center gap-2">
            <span>{{ $t('即刻订阅') }}</span>
            <SvgIcon name="base/rx_ic_arrow_right" />
          </div>
        </RxButton>
      </div>
    </div>
    <div v-else class="relative">
      <img class="block w-140 rounded-5" :src="imageUrls.cover">
      <div class="absolute top-6 right-6 text-white deal-head">
        {{ format(new Date(blackFridayInfo!.start_timestamp), 'yyyy/MM/dd') }} - {{ format(new Date(blackFridayInfo!.end_timestamp),
                                                                                           'yyyy/MM/dd') }}
      </div>
      <RxButton class="!min-w-50 !absolute bottom-6 left-6 z-1" size="lg" severity="secondary" @click="onSubscribe">
        <div class="flex items-center gap-2">
          <span>{{ $t('即刻订阅') }}</span>
          <SvgIcon name="base/rx_ic_arrow_right" />
        </div>
      </RxButton>
      <img class="!absolute -bottom-6.5 -right-7 block w-25.5 z-1" :src="imageUrls.badge">
    </div>
  </div>
</template>

<style lang="scss" scoped>
.deal {
  &-head {
    font-size: 12px;
    font-weight: 500;
  }

  &-title {
    font-family: Archivo;
    font-size: 12.698px;
    font-weight: 700;
  }

  &-text {
    font-size: 36px;
    font-weight: 700;
  }

  &-time {
    font-family: 'JetBrains Mono';
    font-size: 64px;
    font-weight: 700;
  }

  &-unit {
    font-family: 'IBM Plex Sans SC';
    font-size: 40px;
    font-weight: 700;
  }

  &-desc {
    font-size: 20px;
  }
}
</style>
