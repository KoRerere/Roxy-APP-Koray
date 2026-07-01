import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { chmod } from 'node:fs/promises'
import { appConfig } from '/@/constants'
import { isWindows } from '/@/constants/common'
import { checkResource } from '/@/modules/app/checkResource'
import { roxynetReportResolvers } from '/@/modules/appServer/roxynet-receiver'
import { encryptByDESModeCBC, buildRoxynetUpstreamProxy } from '/@/modules/roxynet/util'
import { store } from '/@/modules/store'
import { getNetworkMode } from '/@/modules/store/networkMode'
import { fileExists, getProcessIdsByExePath, isProcessExists, killProcessForce } from '/@/utils'

export * from './util'

let roxynetProcess: ChildProcess | null = null
let lastCheckTime = 0
let startRoxynetInFlight: Promise<void | unknown> | null = null

export function getRoxynetProcess() {
  return roxynetProcess
}

export async function startRoxynet() {
  if (startRoxynetInFlight) {
    return startRoxynetInFlight
  }

  startRoxynetInFlight = startRoxynetInternal().finally(() => {
    startRoxynetInFlight = null
  })
  return startRoxynetInFlight
}

async function startRoxynetInternal() {
  console.log('startRoxynet networkMode:', getNetworkMode())
  console.log('startRoxynet v2raySwitch:', store.v2raySwitch)

  // if (!isKernelSystemProxyEnabled()) {
  //   console.log('networkMode is local')
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
    if (Date.now() - lastCheckTime < 60 * 1000 * 1) {
      return roxynetReportResolvers.promise
    }
    lastCheckTime = Date.now()
    console.log('Roxynet has been started')
    const [processExists] = await isProcessExists([roxynetProcess.pid])
    if (!processExists) {
      console.log('roxynetProcess is not exist')
      roxynetProcess = null
      return startRoxynetInternal()
    }
    return roxynetReportResolvers.promise
  }

  const upstream = await buildRoxynetUpstreamProxy()
  console.log('roxynet upstream proxy', upstream)

  const launchParams = {
    system_proxy: {
      addr: upstream.addr,
      protocal: upstream.protocal,
      v2: upstream.v2,
      ...(getNetworkMode() === 'custom'
        ? { user_name: upstream.user_name ?? '', password: upstream.password ?? '' }
        : {}),
    },
    api_server: `127.0.0.1:${store.appPort}`,
    api_token: store.apiKey,
  }

  const originText = JSON.stringify(launchParams)
  console.log('originText:', originText)
  const encText = encryptByDESModeCBC(originText)

  if (!isWindows) {
    await chmod(appConfig.roxynetBinPath, 0o755)
  }
  const startAppCmdArgs = process.argv.slice(1)
  const startRoxynetArgs = ['--arg', encText]
  const loglevelIndex = startAppCmdArgs.findIndex(item => item === '--loglevel')
  if (loglevelIndex !== -1) {
    startRoxynetArgs.push(...startAppCmdArgs.splice(loglevelIndex, 2))
  }

  if (roxynetProcess) {
    return
  }

  console.log('startAppCmdArgs:', startAppCmdArgs)
  console.log('startRoxynetArgs:', startRoxynetArgs)
  roxynetProcess = spawn(appConfig.roxynetBinPath, startRoxynetArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const { promise, resolve, reject } = Promise.withResolvers<void>()

  // 等待 roxynet 启动完成（api server 监听后才算启动成功）
  let settled = false
  const READY_TIMEOUT_MS = 6_000
  const readyTimer = setTimeout(() => {
    if (settled) {
      return
    }
    settled = true
    reject(new Error('roxynetProcess startup timed out'))
  }, READY_TIMEOUT_MS)

  const settleResolve = () => {
    if (settled) {
      return
    }
    settled = true
    clearTimeout(readyTimer)
    resolve()
  }

  const settleReject = (error: Error) => {
    if (settled) {
      return
    }
    settled = true
    clearTimeout(readyTimer)
    reject(error)
  }

  roxynetProcess.stdout?.on('data', (data) => {
    const output = data.toString()
    console.log(`roxynetProcess stdout: ${output}`)
    setTimeout(() => {
      settleResolve()
    }, 200)
  })

  // 监听 stderr 数据事件
  roxynetProcess.stderr?.on('data', (data) => {
    console.error(`roxynetProcess stderr: ${data}`)
  })

  // 监听子进程关闭事件
  roxynetProcess.on('close', (code) => {
    console.log(`roxynetProcess close with code ${code}`)
    roxynetProcess = null
    settleReject(new Error(`roxynetProcess close before startup completed, code=${code}`))
  })

  roxynetProcess.on('exit', (code) => {
    console.log(`roxynetProcess exited with code ${code}`)
    roxynetProcess = null
  })

  // 监听子进程错误事件
  roxynetProcess.on('error', (error) => {
    console.error('roxynetProcess Error executing file:', error)
    roxynetProcess = null
    settleReject(error)
  })

  console.log(`Child process ID: ${roxynetProcess.pid}`)
  return Promise.all([promise, roxynetReportResolvers.promise])
}

export function stopRoxynet() {
  if (roxynetProcess) {
    roxynetProcess.kill('SIGKILL')
    roxynetProcess = null
  }
}

/**
 * 清理上次 APP 异常退出后残留的 roxynet 僵尸进程
 *
 * - 仅会杀掉可执行路径完全等于 `appConfig.roxynetBinPath` 的进程, 避免误伤其他同名进程
 * - 内部捕获所有错误, 失败时只打印日志, 不会向外抛出, 不影响后续启动流程
 */
export async function killRoxynetZombieProcess() {
  try {
    const exePath = appConfig.roxynetBinPath
    const managedPid = roxynetProcess?.pid
    const pids = (await getProcessIdsByExePath(exePath))
      .filter(pid => pid !== managedPid)
    if (!pids.length) {
      console.log('killRoxynetZombieProcess: no zombie process found at', exePath)
      return
    }
    console.log(`killRoxynetZombieProcess: killing pids [${pids.join(', ')}] for ${exePath}`)
    const results = await Promise.allSettled(pids.map(pid => killProcessForce(pid)))
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`killRoxynetZombieProcess: failed to kill pid ${pids[i]}:`, r.reason)
      }
    })
  }
  catch (error) {
    console.error('killRoxynetZombieProcess error:', error)
  }
}
