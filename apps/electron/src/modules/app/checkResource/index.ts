import { ipcSender } from '/@/modules/ipc/sender'
import { agentUpdater } from '/@/modules/updater/agentUpdater'

/** 发送启动消息 */
export function sendLaunchMessage(message: string) {
  ipcSender.app.launchMessage(message)
}

export async function checkResource() {
  const { promise, resolve } = Promise.withResolvers()
  const startCheckTime = Date.now()
  console.log('checkResource start')
  sendLaunchMessage($t('正在检查资源是否需要更新...'))
  agentUpdater.checkForUpdates({ allowDownload: true }).catch((error) => {
    console.log('checkRoxyagent scripts error', error)
  })
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
