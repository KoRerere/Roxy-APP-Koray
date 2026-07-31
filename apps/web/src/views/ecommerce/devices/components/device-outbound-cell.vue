<script setup lang="ts">
import { formatProxyTime, strConcat } from '/@/utils'
import { ProxyCheckStatus } from '/@/enums'

interface Props {
  country?: string
  city?: string
  lastIp?: string
  time?: string
  status?: ProxyCheckStatus
  isLoading?: boolean
  badgeDesc?: string
}

const props = withDefaults(defineProps<Props>(), {
  country: '',
  city: '',
  lastIp: '',
  time: '',
  status: ProxyCheckStatus.none,
  isLoading: false,
})

const { status, isLoading } = toRefs(props)

const data = computed(() => {
  const text = `${props.country || '--'}${strConcat('/', props.city)}`
  if (isLoading.value) {
    return {
      svg: 'base/rx_ic_earth',
      title: $t('测试中...'),
      color: 'var(--colors-text-text-primary)',
      svgColor: 'var(--colors-icon-icon-tertiary)',
    }
  }
  else if (status.value === ProxyCheckStatus.success) {
    return {
      svg: `country-code/${props.country}`,
      title: text,
      color: 'var(--colors-text-text-success)',
      svgColor: 'var(--colors-icon-icon-tertiary)',
    }
  }
  else if (status.value === ProxyCheckStatus.failure) {
    return {
      svg: 'base/rx_ic_earth',
      title: $t('测试失败'),
      color: 'var(--colors-text-text-error)',
      svgColor: 'var(--colors-icon-icon-error)',
    }
  }
  else {
    return {
      svg: `country-code/${props.country}`,
      title: text,
      color: 'var(--colors-text-text-primary)',
      svgColor: 'var(--colors-icon-icon-note)',
    }
  }
})
</script>

<template>
  <div class="flex gap-2 items-center min-w-50 leading-4">
    <div class="icon">
      <SvgIcon class="block" :name="(data.svg as any)" fallback="base/rx_ic_earth" :color="data.svgColor" size="24" />
    </div>
    <div class="flex flex-col flex-1 gap-1">
      <div class="flex items-center gap-1.5" :style="{ color: data.color }">
        <span class="text-3 font-500">{{ data.title }}</span>
      </div>
      <div class="flex items-center gap-1.5 tt-tertiary text-3">
        <span>{{ lastIp || '--' }}</span>
        <Divider class="!ma-0" layout="vertical" />
        <span>{{ formatProxyTime(time) }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.icon {
  border-radius: 50%;
  border: 0.5px solid var(--colors-border-border-subtle);
  overflow: hidden;
}

.direct {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}
</style>
