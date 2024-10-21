import type { ChildProcess } from 'node:child_process'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { osConfig } from '/@/constants'
import { decryptByDESModeCBC, encryptByDESModeCBC } from '/@/modules/luminet/util'
import { store } from '/@/modules/store'
import { getSystemProxy, isMac, isWindows } from '/@/utils'

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
    api_token: 'a6411a0a0779ff748ea1d6ae4babf6ac',
  }

  const originText = JSON.stringify(launchParams)
  console.log('originText:', originText)
  const encText = encryptByDESModeCBC(originText)
  const exePath = path.join(__dirname, `../buildResources/${isWindows ? 'windows' : 'macos'}/${isWindows ? `x${osConfig.osBit}` : 'apple'}/${isWindows ? 'luminet.exe' : 'luminet'}`)

  if (isMac) {
    execFile('chmod', ['+x', exePath])
  }

  luminetProcess = execFile(exePath, ['--arg', encText])

  console.log(`Child process ID: ${luminetProcess.pid}`)
}

export function stopLuminet() {
  if (luminetProcess) {
    luminetProcess.kill()
    luminetProcess = null
  }
}
