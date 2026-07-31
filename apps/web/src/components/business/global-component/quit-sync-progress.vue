<script setup lang="ts">
import type { QuitSyncProgressMessage } from '@roxy/electron-preload'
import ProgressBar from 'primevue/progressbar'
import { isMainWindow } from '/@/utils'

const state = ref<QuitSyncProgressMessage>({ visible: false })

// 整体进度: 已完成的加权窗口数 / 总窗口数 (单窗口关闭+OSS 计 0.7, 接口同步再计 0.3)
const percent = computed(() => {
  const { current = 0, total = 0 } = state.value
  if (!total) {
    return 0
  }
  return Math.min(100, Math.round((current / total) * 100))
})

// 只展示待同步窗口总数, 不展示已同步数 (避免数字与进度感知冲突)
const detail = computed(() => {
  const { total = 0 } = state.value
  return $t('共 {total} 个窗口待同步', { total })
})

const title = computed(() => {
  if (state.value.reason === 'update') {
    return $t('正在同步数据并准备更新，请稍候…')
  }
  if (state.value.reason === 'logout') {
    return $t('正在同步数据并退出登录，请稍候…')
  }
  return $t('正在同步数据，请稍候…')
})

if (globalThis.isElectron && isMainWindow) {
  globalThis.electronAPI.on('app:quit-sync-progress', (payload) => {
    state.value = payload
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state.visible"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(15,18,20,0.55)] backdrop-blur-[2px]"
      >
        <div class="w-[min(92vw,420px)] rd-3 bg-[var(--colors-background-bg-block,#fff)] px-6 py-5 shadow-xl dark:bg-[#1f2428]">
          <div class="mb-4 flex items-center gap-3">
            <i class="pi pi-spin pi-spinner text-5 text-[var(--colors-text-text-brand,#12a3fc)]" />
            <div class="min-w-0 flex-1">
              <div class="text-3.75 font-600 text-[var(--colors-text-text-primary)] line-height-snug">
                {{ title }}
              </div>
              <div class="mt-1 text-3 text-[var(--colors-text-text-tertiary)]">
                {{ detail }}
              </div>
            </div>
          </div>
          <ProgressBar :value="percent" :show-value="false" class="h-2!" />
          <div class="mt-2 text-right text-3 text-[var(--colors-text-text-tertiary)]">
            {{ percent }}%
          </div>
          <div class="flex items-center gap-2 rd-2 bg-[var(--colors-background-bg-warning-subtle)] px-3 py-2.5">
            <SvgIcon name="base/rx_ic_warn_fill" :size="16" color="var(--colors-icon-icon-warning)" class="shrink-0" />
            <div class="text-3 leading-snug text-[var(--colors-text-text-warning)]">
              {{ $t('请勿强制终止应用，否则可能导致数据同步失败') }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
