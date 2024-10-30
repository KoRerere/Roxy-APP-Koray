import type { ChildProcess } from 'node:child_process'
import { execFile } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { appConfig } from '/@/constants'
import { encryptByDESModeCBC } from '/@/modules/luminet/util'
import { store } from '/@/modules/store'
import { getSystemProxy, isMac } from '/@/utils'

export * from './util'

const execFilePromise = promisify(execFile)
let luminetProcess: ChildProcess | null = null

export function getLuminetProcess() {
  return luminetProcess
}

export async function startLuminet() {
  console.log('startLuminet')
  if (!store.systemProxySwitch) {
    console.log('systemProxySwitch is off')
    return
  }

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
      v2: true, // 是否走v2兼任模式，代理为http的情况下需要设置为true
    },
    api_server: `127.0.0.1:${store.appPort}`,
    api_token: store.apiKey,
  }

  const originText = JSON.stringify(launchParams)
  console.log('originText:', originText)
  const encText = encryptByDESModeCBC(originText)

  if (isMac) {
    await execFilePromise('chmod', ['+x', appConfig.luminetBinPath])
  }
  console.log('luminetBinPath encText:', encText)
  luminetProcess = execFile(appConfig.luminetBinPath, ['--arg', encText])

  // 忽略的错误信息
  const ignoreList = ['check addr  error:dial tcp: missing address']
  // 监听 stdout 数据事件
  luminetProcess.stdout?.on('data', (data) => {
    if (!ignoreList.some(item => data.includes(item))) {
      console.log(`luminetProcess stdout: ${data}`)
    }
  })

  // 监听 stderr 数据事件
  luminetProcess.stderr?.on('data', (data) => {
    console.error(`luminetProcess stderr: ${data}`)
  })

  // 监听子进程关闭事件
  luminetProcess.on('close', (code) => {
    console.log(`luminetProcess exited with code ${code}`)
  })

  // 监听子进程错误事件
  luminetProcess.on('error', (error) => {
    console.error('luminetProcess Error executing file:', error)
  })

  console.log(`Child process ID: ${luminetProcess.pid}`)
  await setTimeout(100)
}

export function stopLuminet() {
  if (luminetProcess) {
    luminetProcess.kill()
    luminetProcess = null
  }
}
