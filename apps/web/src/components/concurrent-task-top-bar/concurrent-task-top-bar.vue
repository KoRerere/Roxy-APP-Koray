<script setup lang="ts">
import { useProxyShopLabels } from '/@/views/agent/shop/utils/proxy-shop-labels'
import { $t } from '/@/locales'

defineProps<{
  completed: number
  total: number
}>()

const shopLabels = useProxyShopLabels()
</script>

<template>
  <Teleport to="body">
    <div class="concurrent-task-top-bar" role="status" aria-live="polite">
      <div class="flex flex-col gap-2 max-w-90 pa-3 rounded-1 pointer-events-auto concurrent-task-top-bar__inner">
        <div class="flex items-center gap-2 text-white">
          <SvgIcon class="loading-circle" name="base/rx_ic_spin" size="18" />
          <div class="flex items-center gap-1 text-3 font-500 leading-normal">
            <span>{{ completed }} / {{ total }}</span>
            <span>{{ shopLabels.concurrentTestingLabel }}</span>
          </div>
        </div>
        <div class="pl-6 text-white opacity-80 text-3 leading-normal">
          {{ $t('当前操作可能需要几分钟时间，请勿离开此页面。') }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.concurrent-task-top-bar {
  position: fixed;
  z-index: 1100;
  left: 0;
  right: 0;
  top: 20px;
  pointer-events: none;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.concurrent-task-top-bar__inner {
  background: var(--colors-background-bg-brand);
  box-shadow:
    0 3px 8px 0 rgba(0, 0, 0, 0.07),
    0 2px 5px 0 rgba(0, 0, 0, 0.07),
    0 1px 1px 0 rgba(0, 0, 0, 0.07);
}
</style>
