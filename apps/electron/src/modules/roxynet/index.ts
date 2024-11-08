import type { ChildProcess } from 'node:child_process'
import { execFile } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { appConfig } from '/@/constants'
import { encryptByDESModeCBC, setSystemProxy } from '/@/modules/roxynet/util'
import { store } from '/@/modules/store'
import { fileExists, getSystemProxy, isMac } from '/@/utils'

export * from './util'

const execFilePromise = promisify(execFile)
let roxynetProcess: ChildProcess | null = null

export function getLuminetProcess() {
  return roxynetProcess
}

export async function startLuminet() {
  console.log('startLuminet systemProxySwitch:', store.systemProxySwitch)
  console.log('startLuminet v2raySwitch:', store.v2raySwitch)

  if (!store.systemProxySwitch) {
    console.log('systemProxySwitch is off')
    return
  }

  const isExist = await fileExists(appConfig.roxynetBinPath)
  if (!isExist) {
    console.log('roxynetBinPath is not exist')
    return
  }

  if (roxynetProcess) {
    // 重新设置系统代理
    setSystemProxy()
    console.log('Luminet has been started')
    return
  }

  const systemProxy = await getSystemProxy()
  console.log('systemProxy', systemProxy)

  if (!systemProxy) {
    console.log('没有获取到系统代理，停止拉起 roxynet')
    return
  }

  const launchParams = {
    system_proxy: {
      addr: systemProxy,
      protocal: 'http',
      v2: store.v2raySwitch, // 是否走v2兼任模式，代理为http的情况下需要设置为true
    },
    api_server: `127.0.0.1:${store.appPort}`,
    api_token: store.apiKey,
  }

  const originText = JSON.stringify(launchParams)
  console.log('originText:', originText)
  const encText = encryptByDESModeCBC(originText)

  if (isMac) {
    await execFilePromise('chmod', ['+x', appConfig.roxynetBinPath])
  }
  console.log('roxynetBinPath encText:', encText)
  const startAppCmdArgs = process.argv.slice(1)
  console.log('startAppCmdArgs:', startAppCmdArgs)
  roxynetProcess = execFile(appConfig.roxynetBinPath, startAppCmdArgs.concat(['--arg', encText]))

  // 忽略的错误信息
  const ignoreList = ['check addr  error:dial tcp: missing address']
  // 监听 stdout 数据事件
  roxynetProcess.stdout?.on('data', (data) => {
    if (!ignoreList.some(item => data.includes(item))) {
      console.log(`roxynetProcess stdout: ${data}`)
    }
  })

  // 监听 stderr 数据事件
  roxynetProcess.stderr?.on('data', (data) => {
    console.error(`roxynetProcess stderr: ${data}`)
  })

  // 监听子进程关闭事件
  roxynetProcess.on('close', (code) => {
    console.log(`roxynetProcess exited with code ${code}`)
  })

  // 监听子进程错误事件
  roxynetProcess.on('error', (error) => {
    console.error('roxynetProcess Error executing file:', error)
  })

  console.log(`Child process ID: ${roxynetProcess.pid}`)
  await setTimeout(100)
}

export function stopLuminet() {
  if (roxynetProcess) {
    roxynetProcess.kill()
    roxynetProcess = null
  }
}
