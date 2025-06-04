<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { formatProxyTime, strConcat } from '/@/utils'
import { ProxyCheckStatus } from '/@/enums'
const props = defineProps({
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
  status: {
    type: Number as PropType<ProxyCheckStatus>,
    default: ProxyCheckStatus.none,
  },
})

const { status } = toRefs(props)

const color = computed(() => {
  if (status?.value === ProxyCheckStatus.success) {
    return 'var(--colors-text-text-success)'
  } else if (status?.value === ProxyCheckStatus.failure) {
    return 'var(--colors-text-text-error)'
  }
  return ''
})
</script>

<template>
  <div class="flex gap-2 proxycard">
    <div>
      <RxSvgIcon :name="(`country-code/${country}` as SvgNames)" fallback="base/rx_ic_earth" :color="color" />
    </div>
    <div class="flex flex-col flex-1 gap-1">
      <div class="flex items-center proxycard-title" :style="{ color }">
        <span>{{ country || '--' }}{{ strConcat('/', city) }}</span>
      </div>
      <div class="flex items-center gap-1.5 proxycard-subtitle">
        <span>{{ lastIp || '--' }}</span>
        <Divider class="!ma-0" layout="vertical" />
        <span>{{ formatProxyTime(time) }}</span>
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
    color: var(--colors-text-text-primary, #fafafa);
    font-weight: 500;
  }

  &-subtitle {
    color: var(--colors-text-text-tertiary, #a3a9ad);
  }
}
</style>
