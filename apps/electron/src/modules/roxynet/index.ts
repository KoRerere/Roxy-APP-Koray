import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { appConfig } from '/@/constants'
import { encryptByDESModeCBC, setSystemProxy } from '/@/modules/roxynet/util'
import { store } from '/@/modules/store'
import { fileExists, getSystemProxy, isProcessRunning } from '/@/utils'
import { isMac } from '/@/constants/common'
import { checkResource } from '/@/modules/app/checkResource'
import { chmod } from 'node:fs/promises'

export * from './util'

let roxynetProcess: ChildProcess | null = null

export function getRoxynetProcess() {
  return roxynetProcess
}

export async function startRoxynet() {
  console.log('startRoxynet systemProxySwitch:', store.systemProxySwitch)
  console.log('startRoxynet v2raySwitch:', store.v2raySwitch)

  // if (!store.systemProxySwitch) {
  //   console.log('systemProxySwitch is off')
  //   return
  // }

  const isExist = await fileExists(appConfig.roxynetBinPath)
  if (!isExist) {
    console.log('roxynetBinPath is not exist')
    await checkResource().catch((error) => {
      console.error('checkResource error:', error)
      return Promise.reject(error)
    })
  }

  if (roxynetProcess?.pid) {
    // 重新设置系统代理
    setSystemProxy()
    console.log('Roxynet has been started')
    const processExists = isProcessRunning(roxynetProcess.pid)
    if (!processExists) {
      console.log('roxynetProcess is not exist')
      roxynetProcess = null
      await startRoxynet()
      return
    }
    return
  }

  const systemProxy = await getSystemProxy()
  console.log('systemProxy', systemProxy)

  // if (!systemProxy) {
  //   console.log('没有获取到系统代理，停止拉起 roxynet')
  //   return
  // }

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
    await chmod(appConfig.roxynetBinPath, 0o755)
  }
  const startAppCmdArgs = process.argv.slice(1)
  const startRoxynetArgs = ['--arg', encText]
  const loglevelIndex = startAppCmdArgs.findIndex(item => item === '--loglevel')
  if (loglevelIndex !== -1) {
    startRoxynetArgs.push(...startAppCmdArgs.splice(loglevelIndex, 2))
  }
  console.log('startAppCmdArgs:', startAppCmdArgs)
  console.log('startRoxynetArgs:', startRoxynetArgs)
  roxynetProcess = spawn(appConfig.roxynetBinPath, startRoxynetArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // 监听 stdout 数据事件
  roxynetProcess.stdout?.on('data', (data) => {
    console.log(`roxynetProcess stdout: ${data}`)
  })

  // 监听 stderr 数据事件
  roxynetProcess.stderr?.on('data', (data) => {
    console.error(`roxynetProcess stderr: ${data}`)
  })

  // 监听子进程关闭事件
  roxynetProcess.on('close', (code) => {
    console.log(`roxynetProcess exited with code ${code}`)
    roxynetProcess = null
  })

  // 监听子进程错误事件
  roxynetProcess.on('error', (error) => {
    console.error('roxynetProcess Error executing file:', error)
  })

  console.log(`Child process ID: ${roxynetProcess.pid}`)
  await setTimeout(100)
}

export function stopRoxynet() {
  if (roxynetProcess) {
    roxynetProcess.kill()
    roxynetProcess = null
  }
}
