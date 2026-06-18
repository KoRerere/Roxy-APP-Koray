import { API } from '/@/api'
import { CLIENT_RECEIVE_VERSION, INSTALL_COMPLETE_VERSION } from '/@/constants/storage-key'
import { useUserStore } from '/@/stores/user'
import { useRoxyClawStore } from '/@/stores/roxy-claw'

import { onMounted } from 'vue'
import { KICKED_OUT_CHANNEL_NAME, MAIN_WINDOW_NAME, MAIN_WINDOW_NAVIGATION_CHANNEL_NAME } from './constants/channel'
import { useDialog } from './hooks/useDialog'
import { $t } from './locales'
import { hidePageLoading, isMainWindow, showPageLoading } from './utils'
import { markSessionLost } from './utils/sessionLost'
import { emitter } from './utils/eventBus'
import type { MittEvents } from './utils/eventBus'
import { compare } from 'compare-versions'

const channel = new BroadcastChannel(KICKED_OUT_CHANNEL_NAME)

export function useApp() {
  const router = useRouter()
  const [showModal] = useDialog()
  const mainWindowNavigationChannel = new BroadcastChannel(MAIN_WINDOW_NAVIGATION_CHANNEL_NAME)

  if (isMainWindow) {
    window.name = MAIN_WINDOW_NAME
  }

  mainWindowNavigationChannel.onmessage = (event) => {
    if (!isMainWindow)
      return

    const target = event.data
    if (target) {
      router.push(target)
    }
    window.focus()
  }

  // RoxyClaw 自动启动
  onMounted(async () => {
    if (globalThis.isElectron) {
      const roxyClawStore = useRoxyClawStore()

      // 确保配置加载完成
      await roxyClawStore.fetchConfig()

      if (roxyClawStore.isEnabled) {
        try {
        // 检查 MCP 窗口是否正在运行
          const mcpStatus = await roxyClawStore.getMcpStatus()
          if (mcpStatus.mcpWindowOpen) {
            console.log('MCP window is open, skipping RoxyClaw auto-start')
            // 重置状态为未启用，避免下次继续尝试
            await roxyClawStore.updateConfig({ enabled: false })
            return
          }

          const result = await roxyClawStore.startRoxyClaw()
          if (result.success) {
            console.log('RoxyClaw auto-started successfully')
          }
          else {
            console.error('Failed to auto-start RoxyClaw:', result.message)
            // 自动启动失败时重置状态为未启用
            await roxyClawStore.updateConfig({ enabled: false })
          }
        }
        catch (error) {
          console.error('Failed to auto-start RoxyClaw:', error)
          // 自动启动失败时重置状态为未启用
          await roxyClawStore.updateConfig({ enabled: false })
        }
      }
    }
  })

  console.log('__WEB_VERSION__', __WEB_VERSION__)

  function handleKickedOut(params: MittEvents['kickedOut']) {
    console.log('handleKickedOut', params)
    hidePageLoading()
    showModal({
      header: $t('登录提醒'),
      style: {
        width: '420px',
      },
      pt: {
        mask: {
          class: '!backdrop-blur',
        },
      },
      cancelText: '',
      closable: false,
      okText: $t('确认'),
      noAutoClose: true,
      slots: {
        default: () => (
          <div>
            <div>
              {$t('当前账号于 {time} 在 {deviceName} 设备上登录。', {
                time: params?.createTime,
                deviceName: decodeURIComponent(params?.deviceName || ''),
              })}
            </div>
            <div class="mt-[20px]">{$t('若非本人操作，请及时修改密码。')}</div>
          </div>
        ),
      },
      handleOk() {
        showPageLoading()
        useUserStore().clearUserInfo()
        router.push({ name: 'login' })
      },
    })
    globalThis.electronAPI.send('browser:closeAll')
  }

  /**
   * 监听其他窗口/标签页发来的消息
   */
  channel.onmessage = (event) => {
    if (isMainWindow) {
      console.log('Received message:', event.data)
      handleKickedOut(event.data)
    }
    else {
      window.close()
    }
  }

  function onKickedOut(params: MittEvents['kickedOut']) {
    if (isMainWindow) {
    // 主进程 user:kicked-out 与接口 405 均算掉登录态，仅记录首次时间
      markSessionLost()
      channel.postMessage(params)
      handleKickedOut(params)
    }
    else {
      window.close()
    }
  }

  emitter.on('kickedOut', onKickedOut)
  globalThis.electronAPI.on('user:kicked-out', onKickedOut)

  let reportAppVersionUpdateCreatePromise: Promise<any> | undefined

  globalThis.electronAPI.on('app:resource-update', async (data) => {
  //   监控每个版本更新：
  // 1. 客户端接收成功数
  // 2. 安装完成版本数
    if (data.type === 'app' && data.status === 'downloaded' && data.version) {
      const clientReceiveVersion = localStorage.getItem(CLIENT_RECEIVE_VERSION)
      // 如果上报过了，则不重复上报
      if (clientReceiveVersion === data.version) {
        return
      }

      // 上报客户端接收成功数
      reportAppVersionUpdateCreatePromise ||= API.base.reportAppVersionUpdateCreate({
        appVersion: data.version,
        type: 'client_receive',
      }).finally(() => {
        reportAppVersionUpdateCreatePromise = undefined
      })
      const result = await reportAppVersionUpdateCreatePromise
      if (result.code === 0) {
      // 上报成功后，记录版本号
        localStorage.setItem(CLIENT_RECEIVE_VERSION, data.version)
      }
    }
  })

  if (globalThis.isElectron && isMainWindow) {
    queueMicrotask(async () => {
      const currentVersion = await globalThis.electronAPI.send('app:getAppVersion')
      // 上次安装完成的版本号
      const installCompleteVersion = localStorage.getItem(INSTALL_COMPLETE_VERSION)

      // 当前版本已高于「客户端接收」记录，且尚未对当前版本上报过安装完成
      const shouldReportInstallComplete = currentVersion
        && currentVersion !== installCompleteVersion

      console.log('shouldReportInstallComplete', shouldReportInstallComplete)

      if (shouldReportInstallComplete) {
        const result = await API.base.reportAppVersionUpdateCreate({
          appVersion: currentVersion,
          type: 'install_complete',
        })
        if (result.code === 0) {
          localStorage.setItem(INSTALL_COMPLETE_VERSION, currentVersion)
        }
      }

      if (compare(currentVersion, '3.8.7', '>=')) {
        globalThis.electronAPI.send('app:restoreLastWindowOpenStatusReady').then(() => {
          console.info('app:restoreLastWindowOpenStatusReady')

          globalThis.electronAPI.send('app:checkNeedRestoreWindow').then((needRestoreWindow) => {
            console.info('checkNeedRestoreWindow', needRestoreWindow)
            if (!needRestoreWindow) {
              return
            }

            showModal({
              header: $t('恢复窗口'),
              class: '!w-[380px]',
              okText: $t('是'),
              cancelText: $t('否'),
              slots: {
                default: () => <>{$t('检测到上次异常退出，是否恢复窗口？')}</>,
              },
              handleOk() {
                globalThis.electronAPI.send('app:restoreWindow')
              },
              handleCancel() {
                globalThis.electronAPI.send('app:cancelRestoreWindow')
              },
            })
          }).catch(() => {
            console.info('need app version 3.8.7')
          })
        })
      }
    })
  }
}
