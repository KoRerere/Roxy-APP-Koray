import { RestoreWindowNetworkChangeContent } from '/@/components/business/restore-window-network-change-content'
import { RestoreWindowNetworkChange } from '/@/enums'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales'
import { isMainWindow } from '/@/utils/common'
import { compare } from 'compare-versions'

/**
 * 异常退出后恢复窗口：确认弹窗、网络变化检测与用户偏好策略。
 */
export function useRestoreWindow() {
  if (!globalThis.isElectron || !isMainWindow)
    return

  const [showModal] = useDialog()

  async function restoreWindow() {
    await globalThis.electronAPI.send('app:restoreWindow')
    cancelRestoreWindow()
  }

  function cancelRestoreWindow() {
    globalThis.electronAPI.send('app:cancelRestoreWindow')
  }

  async function showRestoreConfirmModal(): Promise<boolean> {
    return new Promise((resolve) => {
      showModal({
        header: $t('恢复窗口'),
        class: '!w-[380px]',
        okText: $t('是'),
        cancelText: $t('否'),
        slots: {
          default: () => <>{$t('检测到上次异常退出，是否恢复窗口？')}</>,
        },
        handleOk() {
          resolve(true)
        },
        handleCancel() {
          cancelRestoreWindow()
          resolve(false)
        },
      })
    })
  }

  async function showNetworkChangeModal(
    networkCheck: Awaited<ReturnType<typeof globalThis.electronAPI.send<'app:checkRestoreClientNetworkChanged'>>>,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      showModal({
        header: $t('网络环境发生变化'),
        class: '!w-[480px]',
        okText: $t('是'),
        cancelText: $t('否'),
        slots: {
          default: () => (
            <RestoreWindowNetworkChangeContent
              previous={networkCheck.previous!}
              current={networkCheck.current!}
            />
          ),
        },
        handleOk() {
          resolve(true)
        },
        handleCancel() {
          cancelRestoreWindow()
          resolve(false)
        },
      })
    })
  }

  async function proceedRestoreAfterConfirm(softConfig: Awaited<ReturnType<typeof globalThis.electronAPI.send<'app:getSoftConfig'>>>) {
    const networkCheck = await globalThis.electronAPI.send('app:checkRestoreClientNetworkChanged')

    if (!networkCheck.changed) {
      restoreWindow()
      return
    }

    const action = softConfig.restoreWindowNetworkChange ?? RestoreWindowNetworkChange.Prompt

    if (action === RestoreWindowNetworkChange.Abort) {
      cancelRestoreWindow()
      return
    }

    if (action === RestoreWindowNetworkChange.Continue) {
      restoreWindow()
      return
    }

    if (networkCheck.previous && networkCheck.current) {
      const shouldContinue = await showNetworkChangeModal(networkCheck)
      if (shouldContinue) {
        restoreWindow()
      }
      return
    }

    restoreWindow()
  }

  queueMicrotask(async () => {
    const currentVersion = await globalThis.electronAPI.send('app:getAppVersion')

    if (compare(currentVersion, '3.8.7', '>=')) {
      globalThis.electronAPI.send('app:restoreLastWindowOpenStatusReady').then(async () => {
        console.info('app:restoreLastWindowOpenStatusReady')

        try {
          const needRestoreWindow = await globalThis.electronAPI.send('app:checkNeedRestoreWindow')
          console.info('checkNeedRestoreWindow', needRestoreWindow)
          if (!needRestoreWindow) {
            return
          }

          const softConfig = await globalThis.electronAPI.send('app:getSoftConfig')
          if (softConfig.autoRestoreWindow === 0) {
            cancelRestoreWindow()
            return
          }

          const confirmed = await showRestoreConfirmModal()
          if (!confirmed) {
            return
          }

          await proceedRestoreAfterConfirm(softConfig)
        }
        catch (error) {
          console.info('restore window flow failed', error)
        }
      })
    }
  })
}
