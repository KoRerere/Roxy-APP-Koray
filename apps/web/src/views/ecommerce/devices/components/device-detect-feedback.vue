<script setup lang="ts">
import RxLoading from '/@/components/rx-loading.vue'
import {
  formatDeviceExitDisplay,
  getDeviceDetectResultMeta,
} from '/@/views/ecommerce/devices/hooks/useDeviceDetection'
import type { DeviceDetectPhase } from '/@/views/ecommerce/devices/hooks/useDeviceDetection'
import type { CheckResult } from '/@/views/agent/hooks'

const {
  phase,
  checkResult = null,
  historyMatched = false,
  showHistoryCheck = true,
  checkingText = $t('正在检测设备...'),
} = defineProps<{
  phase: DeviceDetectPhase
  checkResult?: CheckResult | null
  historyMatched?: boolean
  /** 绑定风险场景仅展示连通性结果 */
  showHistoryCheck?: boolean
  checkingText?: string
}>()

const resultMeta = computed(() => {
  if (phase === 'checking')
    return null
  return getDeviceDetectResultMeta(phase)
})

const exitDisplay = computed(() => formatDeviceExitDisplay(checkResult))

const connectivityPassed = computed(() => phase !== 'connectivity-failed')
</script>

<template>
  <template v-if="phase === 'checking'">
    <div class="flex flex-col items-center gap-4 py-8">
      <div class="relative size-10 shrink-0">
        <RxLoading :model-value="true" :size="40" :opacity="1" />
      </div>
      <span class="tt-secondary text-3.25">{{ checkingText }}</span>
    </div>
  </template>

  <template v-else-if="resultMeta">
    <div class="flex flex-col items-center gap-3 text-center">
      <SvgIcon :name="(resultMeta.icon as any)" size="48" :color="resultMeta.iconColor" />
      <div class="tt-primary text-4.5 font-600 leading-normal">
        {{ resultMeta.title }}
      </div>
      <p class="tt-secondary text-3.25 leading-5 m-0">
        {{ resultMeta.desc }}
      </p>
    </div>

    <div class="detect-status-panel flex flex-col gap-3 pa-4 rounded-3">
      <div class="flex items-center gap-2">
        <SvgIcon :name="connectivityPassed ? 'base/rx_ic_check' : 'base/rx_ic_delete_fill'" size="16"
                 :color="connectivityPassed ? 'var(--colors-icon-icon-success)' : 'var(--colors-icon-icon-error)'"
        />
        <span class="tt-primary text-3.25 leading-4.5">
          {{ $t('设备连通性检测') }} · {{ connectivityPassed ? $t('正常') : $t('失败') }}
        </span>
      </div>
      <div v-if="showHistoryCheck && connectivityPassed" class="flex items-center gap-2">
        <SvgIcon :name="historyMatched ? 'base/rx_ic_warn_fill' : 'base/rx_ic_check'" size="16" :color="historyMatched ? 'var(--colors-icon-icon-warning)' : 'var(--colors-icon-icon-success)'" />
        <span class="tt-primary text-3.25 leading-4.5">
          {{ $t('平台半年内历史库匹配') }} · {{ historyMatched ? $t('命中') : $t('未命中') }}
        </span>
      </div>
    </div>

    <div v-if="connectivityPassed" class="detect-exit-panel flex items-center justify-between gap-3 pa-3 rounded-2">
      <span class="tt-secondary text-3 shrink-0">{{ $t('设备出口') }}</span>
      <div class="flex items-center gap-2 min-w-0">
        <SvgIcon v-if="checkResult?.lastCountry" :name="(`country-code/${checkResult.lastCountry}` as any)" fallback="base/rx_ic_earth" size="16" class="shrink-0" />
        <span class="tt-primary text-3.25 leading-4.5 truncate">{{ exitDisplay }}</span>
      </div>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.detect-status-panel {
  background: var(--colors-background-bg-block);
}

.detect-exit-panel {
  border: 1px solid var(--colors-border-border-info);
  background: var(--colors-background-bg-info);
}
</style>
