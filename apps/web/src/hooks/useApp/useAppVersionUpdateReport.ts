import { API } from '/@/api'
import { CLIENT_RECEIVE_VERSION, INSTALL_COMPLETE_VERSION } from '/@/constants/storage-key'
import { isMainWindow } from '/@/utils/common'

let reportAppVersionUpdateCreatePromise: Promise<any> | undefined

/**
 * 客户端版本更新上报：下载完成时上报 client_receive，启动时上报 install_complete。
 */
export function useAppVersionUpdateReport() {
  console.log('__WEB_VERSION__', __WEB_VERSION__)

  globalThis.electronAPI.on('app:resource-update', async (data) => {
    // 监控每个版本更新：
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
    })
  }
}
