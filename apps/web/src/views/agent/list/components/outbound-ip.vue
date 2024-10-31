<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { strConcat } from '/@/utils'

defineProps({
  image: {
    type: String,
    default: '',
  },
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
  <div class="outbound">
    <img v-if="image" class="outbound-img" :src="image">
    <RxSvgIcon v-else class="outbound-img" :name="(`country-code/${country}` as SvgNames)" fallback="base/rx_ic_earth" />
    <div class="flex justify-between outbound-region">
      <span>{{ country || '--' }}{{ strConcat('/', city) }}</span>
    </div>
    <div v-if="lastIp" class="flex items-center outbound-info">
      <span>{{ lastIp }}</span>
      <Divider class="!ma-0" layout="vertical" />
      <span>{{ formatTime(time) }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.outbound {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-info {
    gap: var(--spacing-sm, 8px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
