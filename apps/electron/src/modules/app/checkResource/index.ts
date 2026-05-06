import { getWebDomain } from '/@/api/util'
import { checkRoxynetBin } from '/@/modules/app/checkResource/checkRoxynetBin'
import { checkRoxySyncBin } from '/@/modules/app/checkResource/checkRoxySyncBin'
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
  try {
    const webDomain = await getWebDomain()
    // 检测更新 roxynet
    await checkRoxynetBin(webDomain).catch((error) => {
      console.log('checkRoxynetBin error', error)
    })
    // 检测更新 roxySync
    await checkRoxySyncBin(webDomain).catch((error) => {
      console.log('checkRoxySyncBin error', error)
    })
    agentUpdater.checkForUpdates().catch((error) => {
      console.log('checkRoxyagent scripts error', error)
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
