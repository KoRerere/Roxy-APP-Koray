<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { getImage, isMacOS } from '/@/utils'
import type { BrowserProcessMessage } from '@roxy/electron-preload'
import { CoreType } from '/@/enums/base'

const startTime = Date.now()
const dirId = new URLSearchParams(window.location.search).get('dirId')
const coreType = new URLSearchParams(window.location.search).get('coreType') || CoreType.Chrome
const currentText = ref($t('正在打开 RoxyBrowser，请稍候…'))
const launchProcessMessage = ref<BrowserProcessMessage | null>(null)

/**
 * beforeLaunchTask.ts: 内核可用性检测任务区间为 30 -> 80
 * 在该任务内，主进度会按 payload.percent(0-100) 映射到 [30,80]
 * 这里把收到的“总进度”反推为“内核下载/检测进度(0-100)”
 */
const kernelDownloadPercent = computed(() => {
  const total = launchProcessMessage.value?.percent
  if (typeof total !== 'number')
    return null

  const start = 30
  const end = 80
  if (total <= start)
    return 0
  if (total >= end)
    return 100

  const percent = ((total - start) / (end - start)) * 100
  return Math.min(100, Math.max(0, Math.round(percent)))
})

globalThis.electronAPI.send('browser:getOpenedBrowserMessage').then((state) => {
  console.log('browser:getOpenedBrowserMessage state', state)
  const target = state.find(item => item.dirId === dirId)
  if (target) {
    currentText.value = target.message
    if (target.percent >= 100) {
      closeWindow()
    }
  }
})

const cancelListenOpenMessage = globalThis.electronAPI.on('browser:launch-process-message', (event) => {
  console.log('browser:launch-process-message event', event)
  launchProcessMessage.value = event.data
  const id = event.data?.dirId

  if (id === dirId) {
    currentText.value = event.data?.message || event.message

    if (event.data?.percent >= 100 || event.code === 1) {
      closeWindow()
    }
  }
})

function cancelListenAll() {
  cancelListenOpenMessage()
}

onBeforeUnmount(() => {
  cancelListenAll()
})

window.addEventListener('beforeunload', () => {
  cancelListenAll()
})

async function closeWindow(force = false) {
  // 如何显示时间小于 2 秒，则延迟关闭窗口，避免窗口闪烁
  if (!force && Date.now() - startTime < 2000) {
    await new Promise(r => setTimeout(r, 2000))
  }

  window.close()
  cancelListenAll()
}
</script>

<template>
  <div class="drag-region-top">
    <RxButton v-if="!isMacOS" class="close no-drag" text severity="secondary" icon="base/rx_ic_delete" size="xxs" @click="closeWindow(true)" />
  </div>
  <div class="openning-screen">
    <motion.div :initial="{ rotate: 45, scale: 0.96, opacity: 0 }" :animate="{ rotate: -315, scale: 1, opacity: 1 }" :transition="{
      rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
      scale: { duration: 0.64, delay: 0.4 },
      opacity: { duration: 0.64, delay: 0.4 },
    }" class="roxychrome"
    >
      <img :src="getImage('browser/roxychrome.svg')">
    </motion.div>
    <div class="info-container">
      <motion.h1 :initial="{ x: -10, opacity: 0 }" :animate="{ x: 0, opacity: 1 }" :transition="{ duration: 0.32, delay: 0.1 }">
        {{ coreType === CoreType.Chrome ? 'RoxyChrome' : 'RoxyFirefox' }}
      </motion.h1>
      <motion.div :initial="{ x: -10, opacity: 0 }" :animate="{ x: 0, opacity: 1 }" :transition="{ duration: 0.32, delay: 0.2 }">
        <AnimatePresence mode="wait">
          <motion.p :key="currentText" :initial="{ y: 6, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :exit="{ y: -6, opacity: 0 }" :transition="{ duration: 0.48, ease: [0, 0.71, 0.2, 1.01] }">
            {{ currentText }}
            <template v-if="kernelDownloadPercent !== null && kernelDownloadPercent > 0 && kernelDownloadPercent < 100">
              ... {{ kernelDownloadPercent }}%
            </template>
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </div>
  </div>
</template>

<style lang="scss">
.drag-region-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  -webkit-app-region: drag;
  min-height: 26px;
  z-index: 1000;
  padding: 8px;
  display: flex;
  justify-content: flex-end;
}

.close {
  &:not(:hover) {
    background-color: transparent;
  }
}

.no-drag {
  -webkit-app-region: no-drag;
}

.openning-screen {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(180deg, #f2fbff 0%, #fff 100%);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;

  .roxychrome {
    img {
      width: 100%;
      height: 100%;
      user-select: none;
      -webkit-user-drag: none;
    }

    position: absolute;
    top: -60px;
    left: -160px;
  }

  .info-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-left: 380px;
    text-align: left;
    gap: 8px;
  }

  h1 {
    color: #042144;
    font-family: Archivo;
    font-size: 24px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    margin: 0;
  }

  p {
    color: #575d60;
    font-size: 12px;
    font-weight: 400;
    line-height: normal;
    margin: 0;
  }
}
</style>
