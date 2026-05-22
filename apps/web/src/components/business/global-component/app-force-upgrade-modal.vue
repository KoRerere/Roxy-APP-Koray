<script setup lang="ts">
import MotionArrow from '/@/layout/components/header/resource-updater/motion-arrow.vue'
import { useForceUpgradeOnSessionLostReturn } from './useForceUpgradeOnSessionLostReturn'
import { useUserStore } from '/@/stores/user'
import { isNewerVersion } from '/@/utils/common'

const userStore = useUserStore()
const visible = ref(false)
/** 自动升级倒计时（秒），弹窗展示后才开始递减 */
const seconds = ref(15)
const newVersion = ref('')

let countdownTimer: ReturnType<typeof setInterval> | undefined

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = undefined
  }
}

function startCountdown() {
  clearCountdown()
  seconds.value = 15
  countdownTimer = setInterval(() => {
    if (seconds.value <= 1) {
      clearCountdown()
      upgradeNow()
      return
    }
    seconds.value -= 1
  }, 1000)
}

/** 展示弹窗并启动倒计时（仅在用户回到 APP 且满足掉登录态条件时调用） */
function showModal(version?: string) {
  if (visible.value)
    return

  if (version)
    newVersion.value = version

  visible.value = true
  startCountdown()
}

/** 立即重启并安装更新 */
async function upgradeNow() {
  clearCountdown()
  await globalThis.electronAPI.send('app:quitAndInstall', {
    type: 'app',
  })
}

/** 远程版本高于本地时才展示弹窗 */
async function tryShowForceUpgrade(remoteVersion: string) {
  const localVersion = userStore.appVersion || await globalThis.electronAPI.send('app:getAppVersion')
  if (!isNewerVersion(remoteVersion, localVersion))
    return

  newVersion.value = remoteVersion
  showModal(remoteVersion)
}

// 后台下载完成时同步版本号（仅当高于当前版本时更新展示）
globalThis.electronAPI.on('app:resource-update', async (data) => {
  if (data.type !== 'app' || !data.version)
    return

  const localVersion = userStore.appVersion || await globalThis.electronAPI.send('app:getAppVersion')
  if (isNewerVersion(data.version, localVersion))
    newVersion.value = data.version
})

if (globalThis.isElectron) {
  useForceUpgradeOnSessionLostReturn(tryShowForceUpgrade)
}

onBeforeUnmount(() => {
  clearCountdown()
})
</script>

<template>
  <Dialog v-model:visible="visible" modal :close-on-escape="false" :closable="false" class="w-105" :pt="{ header: '!hidden', content: '!pa-6 !pt-4' }">
    <div class="flex flex-col gap-4">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('软件即将更新') }}
      </div>

      <div class="flex flex-col gap-2">
        <MotionArrow class="mx-auto pt-2 pb-1.5" />
        <div class=" tt-primary font-[JetBrains_Mono] font-700 text-center text-4 leading-5">
          v{{ userStore.appVersion }} -> v{{ newVersion }}
        </div>
      </div>

      <div class=" tt-secondary text-3.5 leading-5">
        {{ $t('新版本已准备就绪，将在 {seconds} 秒后自动更新。', { seconds }) }}
      </div>

      <div class="-mt-1 flex flex-col gap-2 self-stretch">
        <RxButton class="capitalize" size="lg" :label=" $t('立即更新')" @click="upgradeNow" />
      </div>
    </div>
  </Dialog>
</template>
