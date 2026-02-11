import { getWebDomain } from '/@/api/util'
import { checkRoxynetBin } from '/@/modules/app/checkResource/checkRoxynetBin'
import { checkRoxySyncBin } from '/@/modules/app/checkResource/checkRoxySyncBin'
import { ipcSender } from '/@/modules/ipc/sender'
import { appUpdater } from '/@/modules/updater'
import { agentUpdater } from '/@/modules/updater/agentUpdater'
import { webUpdater } from '/@/modules/updater/webUpdater'

/** 发送启动消息 */
export function sendLaunchMessage(message: string) {
  ipcSender.app.launchMessage(message)
}

export async function checkResource() {
  const { promise, resolve, reject } = Promise.withResolvers()
  const startCheckTime = Date.now()
  console.log('checkResource start')
  sendLaunchMessage($t('正在检查资源是否需要更新...'))
  try {
    // 检测更新 app
    // await appUpdater.init(true, {
    //   onDownloadProgress: (percentage) => {
    //     if (percentage === 100) {
    //       sendLaunchMessage($t('下载完成，准备重启...'))
    //       setTimeout(() => {
    //         appUpdater.upgradeNow()
    //         // 超时后强制退出
    //         setTimeout(() => {
    //           appUpdater.quitAndInstall()
    //         }, 1500)
    //       }, 500)
    //       reject('下载完成，准备重启...')
    //     } else {
    //       sendLaunchMessage($t('正在更新中... {percentage}%', { percentage }))
    //     }
    //   },
    // }).catch((error) => {
    //   console.log('appUpdater init error', error)
    // })
    const webDomain = await getWebDomain()
    // 检测更新 roxynet
    await checkRoxynetBin(webDomain).catch((error) => {
      console.log('checkRoxynetBin error', error)
    })
    // 检测更新 roxySync
    await checkRoxySyncBin(webDomain).catch((error) => {
      console.log('checkRoxySyncBin error', error)
    })
    await agentUpdater.checkForUpdates().catch((error) => {
      console.log('checkRoxyagent scripts error', error)
    })
    // 检测更新 web
    await webUpdater.checkForUpdates({
      onDownloadProgress: (percentage) => {
        sendLaunchMessage($t('正在更新 UI 资源 {percentage}%', { percentage }))
      },
      onDownloadComplete: async () => {
        sendLaunchMessage($t('UI 资源更新完成'))
        await webUpdater.extract()
      },
    }).catch((error) => {
      console.log('webUpdater checkForUpdates error', error)
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
