import { ChildProcess, spawn } from "node:child_process";
import { appConfig } from "/@/constants";
import { Buffer } from "node:buffer";
import { syncSettings } from "/@/modules/sync-control/model";

type RoxySyncStartResult = { "listening": number, "monitors": [{ "height": number, "index": number, "width": number }] }

let roxySyncProcess: ChildProcess | null = null
let roxySyncStartResult = {} as RoxySyncStartResult


export function getRoxySyncStartResult() {
  return roxySyncStartResult
}

export function getRoxySyncAPIBaseURL() {
  return `http://127.0.0.1:${roxySyncStartResult.listening}`
}

export async function startRoxySync(pIds: number[] = []) {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  // 1. 启动同步
  // 命令：
  // roxysync.exe --pids=pid1,pid2,pid3...  --settings=base64(settings结构)
  const startArgs = [
    `--pids=${pIds.join(',')}`,
    `--settings=${Buffer.from(JSON.stringify(syncSettings)).toString('base64')}`,
  ]
  console.log('startRoxySync startArgs:', startArgs)

  if (startArgs.length === 0) {
    console.log('startRoxySync startArgs is empty')
    resolve(false)
    return
  }

  roxySyncProcess = spawn(appConfig.roxySyncBinPath, startArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  roxySyncProcess.on('exit', (code) => {
    console.log(`roxy-sync exited with code ${code}`)
  })

  roxySyncProcess.on('error', (error) => {
    console.error('roxy-sync error:', error)
  })

  // 监听 stdout 数据事件
  roxySyncProcess.stdout?.on('data', (data) => {
    console.log(`roxySyncProcess stdout: ${data}`)
  })

  // 监听 stderr 数据事件
  roxySyncProcess.stderr?.on('data', (data) => {
    console.error(`roxySyncProcess stderr: ${data}`)
    if (data.includes('start success:')) {
      try {
        roxySyncStartResult = JSON.parse(data.toString().replace('start success:', ''))
        console.log('roxySync Start Result:', roxySyncStartResult)
        resolve(true)
      } catch (error) {
        console.error('roxySync Start Result parse error:', error)
        resolve(false)
      }
    } else {
      resolve(false)
    }
  })

  // 6s 超时
  setTimeout(() => {
    resolve(false)
  }, 6000)

  return promise
}


export function stopRoxySync() {
  if (roxySyncProcess) {
    roxySyncProcess.kill()
    roxySyncProcess = null
    roxySyncStartResult = {} as RoxySyncStartResult
  }
}
