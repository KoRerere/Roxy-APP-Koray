<script setup lang="ts">
import DeviceDetectFeedback from './device-detect-feedback.vue'
import { useDeviceDetectionSession } from '/@/views/ecommerce/devices/hooks/useDeviceDetection'
import type { DeviceDetectionParams } from '/@/views/ecommerce/devices/hooks/useDeviceDetection'
import type { CheckResult } from '/@/views/agent/hooks'

const { formData, isDirect, onConfirm } = defineProps<{
  /** 待检测的表单数据 */
  formData: DeviceDetectionParams
  /** 直连白名单用户标记 */
  isDirect?: boolean
  onConfirm: (result: CheckResult) => void | Promise<void>
}>()

const emit = defineEmits<{
  close: []
}>()

const { phase, checkResult, historyMatched, run } = useDeviceDetectionSession()

onMounted(() => {
  run(formData, { isDirect })
})

async function handleConfirm() {
  if (checkResult.value)
    await onConfirm(checkResult.value)
}
</script>

<template>
  <div class="device-detect-modal w-120 flex flex-col gap-6 pa-6 pt-4 rounded-2">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('检测结果') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="emit('close')" />
    </div>

    <DeviceDetectFeedback :phase="phase" :check-result="checkResult" :history-matched="historyMatched" />

    <div v-if="phase !== 'checking'" class="flex gap-2.5 justify-end">
      <template v-if="phase === 'success'">
        <RxButton size="md" class="w-full" :label="$t('完成导入')" @click="handleConfirm" />
      </template>
      <template v-else-if="phase === 'connectivity-failed'">
        <RxButton size="md" severity="secondary" outlined :label="$t('取消')" @click="emit('close')" />
        <RxButton size="md" :label="$t('重新检测')" @click="run(formData, { isDirect })" />
      </template>
      <template v-else>
        <RxButton size="md" severity="secondary" outlined :label="$t('取消')" @click="emit('close')" />
        <RxButton size="md" :label="$t('仍要导入')" @click="handleConfirm" />
      </template>
    </div>
  </div>
</template>
