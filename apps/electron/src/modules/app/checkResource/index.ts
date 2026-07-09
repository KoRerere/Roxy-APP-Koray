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
    // 注意：roxynet / roxysync 不再在此处（启动页）阻塞式联网下载，
    // 改为“启动本地 seed 自愈 + 后台 pending 更新 + 空闲 apply”（见 modules/updater/binUpdater）。
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
