import type { ChildProcess } from 'node:child_process'
import { execFile, execFileSync } from 'node:child_process'
import { appConfig } from '/@/constants'
import { encryptByDESModeCBC } from '/@/modules/luminet/util'
import { store } from '/@/modules/store'
import { getSystemProxy, isMac } from '/@/utils'

export * from './util'

let luminetProcess: ChildProcess | null = null

export async function startLuminet() {
  if (luminetProcess) {
    console.log('Luminet has been started')
    return
  }

  const systemProxy = await getSystemProxy()
  console.log('systemProxy', systemProxy)

  const launchParams = {
    system_proxy: {
      addr: systemProxy,
      protocal: 'http',
      v2: false, // 是否走v2兼任模式，代理为http的情况下需要设置为true
    },
    api_server: `127.0.0.1:${store.appPort}`,
    api_token: store.apiKey,
  }

  const originText = JSON.stringify(launchParams)
  console.log('originText:', originText)
  const encText = encryptByDESModeCBC(originText)

  if (isMac) {
    execFileSync('chmod', ['+x', appConfig.luminetBinPath])
  }

  luminetProcess = execFile(appConfig.luminetBinPath, ['--arg', encText])

  console.log(`Child process ID: ${luminetProcess.pid}`)
}

export function stopLuminet() {
  if (luminetProcess) {
    luminetProcess.kill()
    luminetProcess = null
  }
}
