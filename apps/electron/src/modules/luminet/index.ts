import type { ChildProcess } from 'node:child_process'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { decryptByDESModeCBC, encryptByDESModeCBC } from '/@/modules/luminet/util'
import { store } from '/@/modules/store'
import { getSystemProxy } from '/@/utils'

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
    },
    api_server: `127.0.0.1:${store.appPort}`,
    api_token: 'a6411a0a0779ff748ea1d6ae4babf6ac',
  }

  const originText = JSON.stringify(launchParams)
  console.log('加密前:', originText)
  const encText = encryptByDESModeCBC(originText)

  luminetProcess = execFile(path.join(__dirname, '../buildResources/luminet.exe'), ['--arg', encText], (error, stdout, stderr) => {
    if (error) {
      console.error(`execFile error: ${error}`)
      return
    }
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  })

  console.log(`Child process ID: ${luminetProcess.pid}`)

  console.log('加密后:', encText)
  const decText = decryptByDESModeCBC(encText)
  console.log('解密后:', decText)
}

export function stopLuminet() {
  if (luminetProcess) {
    luminetProcess.kill()
    luminetProcess = null
  }
}
