<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { formatProxyTime, strConcat } from '/@/utils'
import { ProxyCheckStatus } from '/@/enums'
import { $t } from '/@/locales'

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
  isLoading: {
    type: Boolean,
    default: false,
  },
})

const { status, isLoading } = toRefs(props)

const data = computed(() => {
  const text = `${props.country || '--'}${strConcat('/', props.city)}`;
  if (isLoading.value) {
    return {
      title: $t('测试中...'),
      color: 'var(--colors-text-text-primary)',
      svgColor: 'var(--colors-icon-icon-tertiary)'
    }
  } else if (status.value === ProxyCheckStatus.success) {
    return {
      title: text,
      color: 'var(--colors-text-text-success)',
      svgColor: 'var(--colors-icon-icon-tertiary)'
    };
  } else if (status.value === ProxyCheckStatus.failure) {
    return {
      title: $t('测试失败'),
      color: 'var(--colors-text-text-error)',
      svgColor: 'var(--colors-icon-icon-error)'
    }
  } else {
    return {
      title: text,
      color: 'var(--colors-text-text-primary)',
      svgColor: 'var(--colors-icon-icon-note)'
    }
  }
})
</script>

<template>
  <div class="flex gap-2 proxycard">
    <div>
      <RxSvgIcon :name="(`country-code/${country}` as SvgNames)" fallback="base/rx_ic_earth" :color="data.svgColor" />
    </div>
    <div class="flex flex-col flex-1 gap-1">
      <div class="flex items-center proxycard-title" :style="{ color: data.color }">
        <span>{{ data.title }}</span>
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
    font-weight: 500;
  }

  &-subtitle {
    color: var(--colors-text-text-tertiary);
  }
}
</style>
