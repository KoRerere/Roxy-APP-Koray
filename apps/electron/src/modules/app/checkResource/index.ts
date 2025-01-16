import { getWebDomain } from '/@/api/util'
import { checkRoxynetBin } from '/@/modules/app/checkResource/checkRoxynetBin'
import { checkRoxySyncBin } from '/@/modules/app/checkResource/checkRoxySyncBin'
import { ipcMain } from '/@/modules/ipc'
import { webUpdater } from '/@/modules/updater/webUpdater'

/** 发送启动消息 */
export function sendLaunchMessage(message: string) {
  ipcMain.send('app:launch-message', message)
}

export async function checkResource() {
  const { promise, resolve } = Promise.withResolvers()
  const startCheckTime = Date.now()
  console.log('checkResource start')
  sendLaunchMessage($t('正在检查资源是否需要更新...'))
  try {
    const webDomain = await getWebDomain()
    // 检测更新 roxynet
    await checkRoxynetBin(webDomain)
    // 检测更新 roxySync
    await checkRoxySyncBin(webDomain)
    // 检测更新 web
    await webUpdater.checkForUpdates({
      onDownloadProgress: (percentage) => {
        sendLaunchMessage($t('正在更新 UI 资源 {percentage}%', { percentage }))
      },
      onDownloadComplete: async () => {
        sendLaunchMessage($t('UI 资源更新完成'))
        await webUpdater.extract()
      },
    })
  }
  catch (error) {
    console.error('checkResource error', error)
  }
  console.log('checkResource end')
  if (Date.now() - startCheckTime < 1500) {
    setTimeout(() => {
      sendLaunchMessage($t('检查完成'))
      resolve(true)
    }, 1800)
  }
  else {
    sendLaunchMessage($t('检查完成'))
    resolve(true)
  }
  return promise
}
