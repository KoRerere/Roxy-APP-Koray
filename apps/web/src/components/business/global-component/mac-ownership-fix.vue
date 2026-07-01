<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import RxButton from '/@/components/rx-button'
import { isMainWindow } from '/@/utils'

// macOS 旧版本遗留的 .app 属主问题修复弹窗：
// 渲染进程加载完成后向主进程查询状态，需要修复则弹窗引导授权，授权后主进程自动重启完成修复。
const toast = useToast()

const visible = ref(false)
// 点击「授权并继续」后置为 true：主进程会写标记并退出 App，期间禁用按钮避免重复触发
const submitting = ref(false)
// 「跳过」按钮倒计时（秒）：弹窗出现后 3 秒内禁用，避免用户误触直接跳过
const skipCountdown = ref(3)
let skipTimer: ReturnType<typeof setInterval> | undefined

/** 启动「跳过」按钮倒计时 */
function startSkipCountdown() {
  skipCountdown.value = 3
  clearInterval(skipTimer)
  skipTimer = setInterval(() => {
    skipCountdown.value -= 1
    if (skipCountdown.value <= 0) {
      clearInterval(skipTimer)
    }
  }, 1000)
}

onBeforeUnmount(() => {
  clearInterval(skipTimer)
})

// 修复说明正文（含换行，模板用 whitespace-pre-line 渲染）
const bodyText = $t('由于早期版本的权限残留，导致每次更新都会弹出 Mac 密码窗口。\n建议您现在完成最后一次授权以修复此问题，此后的升级将不再需要重复输入密码。')

onMounted(async () => {
  // 仅在 Electron 主窗口环境下检测；非 macOS / 已修复时主进程会返回 needFix=false
  if (!globalThis.isElectron || !isMainWindow) {
    return
  }

  try {
    const status = await globalThis.electronAPI.send('app:getMacOwnershipFixStatus')
    // 上一次修复成功（修复后重启）：提示一次成功
    if (status?.justFixed) {
      toast.add({
        severity: 'success',
        summary: $t('授权成功，后续升级已免密'),
        detail: $t('权限问题已修复，今后更新将自动完成，不再弹出密码窗口。'),
        life: 6000,
      })
    }
    // 仍需修复：弹窗引导用户授权，并启动「跳过」倒计时
    if (status?.needFix) {
      visible.value = true
      startSkipCountdown()
    }
  }
  catch (error) {
    console.error('[macOwnershipFix] 查询修复状态失败', error)
  }
})

/** 授权并继续：主进程执行 copy-replace 并自动重启，期间 App 会退出 */
async function handleAuthorize() {
  submitting.value = true
  try {
    await globalThis.electronAPI.send('app:confirmMacOwnershipFix')
  }
  catch (error) {
    submitting.value = false
    console.error('[macOwnershipFix] 触发修复失败', error)
  }
}

/** 跳过：仅关闭弹窗，下次启动会再次提示 */
function handleSkip() {
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :closable="false"
    :draggable="false"
    :header="$t('只需一次授权，后续免密升级')"
    :style="{ width: '420px' }"
  >
    <p class="m-0 whitespace-pre-line text-3.5 text-color-secondary leading-relaxed">
      {{ bodyText }}
    </p>
    <template #footer>
      <RxButton
        outlined
        :label="skipCountdown > 0 ? `${$t('跳过')} (${skipCountdown})` : $t('跳过')"
        :disabled="submitting || skipCountdown > 0"
        @click="handleSkip"
      />
      <RxButton :label="$t('授权并继续')" :loading="submitting" @click="handleAuthorize" />
    </template>
  </Dialog>
</template>
