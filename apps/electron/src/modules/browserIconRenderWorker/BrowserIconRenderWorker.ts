import type { BrowserIconRenderWorkerMessage } from './taskTypes'
import type { WriteBrowserIconPayload } from './writeBrowserIcon'
import type { UtilityProcess } from 'electron'
import { app, utilityProcess } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { appCliStartArgs, isDev } from '/@/constants/common'
import { isDevToolsUnlocked } from '/@/modules/devtools-guard'
import { writeBrowserIconFile } from './writeBrowserIcon'

interface PendingTask {
  taskId: number
  payload: WriteBrowserIconPayload
  resolve: () => void
  reject: (reason: Error) => void
}

let browserIconWorkerInspectPort = 9240

export class BrowserIconRenderWorker {
  private worker: UtilityProcess | null = null
  private pendingQueue: PendingTask[] = []
  private runningTask: PendingTask | null = null
  private taskIdCounter = 1
  private readonly useInProcessFallback: boolean

  constructor() {
    this.useInProcessFallback = !process.versions.electron
  }

  /** 在 utility 子进程中渲染并写入图标；非 Electron 环境（如 tsx 脚本）回退为进程内执行 */
  async writeIcon(payload: WriteBrowserIconPayload): Promise<void> {
    if (this.useInProcessFallback) {
      await writeBrowserIconFile(payload)
      return
    }

    const { promise, resolve, reject } = Promise.withResolvers<void>()
    this.pendingQueue.push({
      taskId: this.taskIdCounter++,
      payload,
      resolve,
      reject,
    })

    await app.whenReady()
    this.drainQueue()
    return promise
  }

  terminate(): void {
    if (this.worker) {
      this.worker.kill()
      this.worker = null
    }

    const err = new Error('browser icon render worker terminated')
    if (this.runningTask) {
      this.runningTask.reject(err)
      this.runningTask = null
    }
    while (this.pendingQueue.length > 0) {
      this.pendingQueue.shift()?.reject(err)
    }
  }

  private drainQueue(): void {
    if (this.runningTask || this.pendingQueue.length === 0)
      return

    this.runningTask = this.pendingQueue.shift()!
    try {
      const worker = this.ensureWorker()
      worker.postMessage({
        taskId: this.runningTask.taskId,
        payload: this.runningTask.payload,
      })
    }
    catch (error) {
      const task = this.runningTask
      this.runningTask = null
      task.reject(error instanceof Error ? error : new Error(String(error)))
      this.drainQueue()
    }
  }

  private ensureWorker(): UtilityProcess {
    if (this.worker)
      return this.worker

    const workerScript = this.resolveWorkerScriptPath()
    // 调试端口需同时满足开发者工具已解锁，避免正式版对外暴露 Node 调试接口
    const enableInspect = isDevToolsUnlocked() && (appCliStartArgs['roxy-log-level'] === 'debug' || isDev)
    const worker = utilityProcess.fork(workerScript, [], {
      execArgv: enableInspect ? [`--inspect=${browserIconWorkerInspectPort++}`] : [],
      serviceName: 'roxyBrowserIconRenderWorker',
    })

    worker.on('message', (message: BrowserIconRenderWorkerMessage) => {
      this.handleWorkerMessage(message)
    })
    worker.on('exit', (code) => {
      console.warn('[BrowserIconRenderWorker] worker exited', code)
      this.worker = null

      const task = this.runningTask
      if (task) {
        this.runningTask = null
        task.reject(new Error('browser icon render worker exited unexpectedly'))
      }

      this.drainQueue()
    })

    console.log('[BrowserIconRenderWorker] worker started', worker.pid)
    this.worker = worker
    return worker
  }

  private resolveWorkerScriptPath(): string {
    const dir = import.meta.dirname
    for (const name of ['browserIconRenderWorker.mjs']) {
      const candidate = path.join(dir, name)
      if (existsSync(candidate))
        return candidate
    }

    throw new Error(`browser icon render worker script not found in ${dir}`)
  }

  private handleWorkerMessage(message: BrowserIconRenderWorkerMessage): void {
    const task = this.runningTask
    if (!task || message.taskId !== task.taskId)
      return

    this.runningTask = null

    if (message.status === 'success') {
      task.resolve()
    }
    else {
      task.reject(new Error(message.error ?? 'browser icon render failed'))
    }

    this.drainQueue()
  }
}
