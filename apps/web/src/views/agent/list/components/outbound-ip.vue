<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { strConcat } from '/@/utils'

defineProps({
  country: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: '',
  },
  lastIp: {
    type: String,
    default: '',
  },
  time: {
    type: String,
    default: '',
  },
})

function formatTime(time: string) {
  const now = new Date()
  const timestamp = new Date(time).getTime()
  const diff = (now.getTime() - timestamp) / 1000
  const day = Math.floor(diff / 86400)
  const hour = Math.floor(diff / 3600)
  const minute = Math.floor(diff / 60)

  if (day > 7) {
    return time.split(' ')[0].replace(/-/g, '/')
  }
  else if (day > 0) {
    return `${day}天前`
  }
  else if (hour > 0) {
    return `${hour}小时前`
  }
  else if (minute > 0) {
    return `${minute}分钟前`
  }
  else {
    return '刚刚'
  }
}
</script>

<template>
  <div class="proxycard flex gap-2">
    <div>
      <RxSvgIcon :name="(`country-code/${country}` as SvgNames)" fallback="base/rx_ic_earth" />
    </div>
    <div class="flex flex-col flex-1 gap-1">
      <div class="flex items-center proxycard-title">
        <span>{{ country || '--' }}{{ strConcat('/', city) }}</span>
      </div>
      <div class="flex items-center gap-1.5 proxycard-subtitle">
        <span>{{ lastIp }}</span>
        <Divider class="!ma-0" layout="vertical" />
        <span>{{ formatTime(time) }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxycard {
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);

  &-title {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-subtitle {
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
