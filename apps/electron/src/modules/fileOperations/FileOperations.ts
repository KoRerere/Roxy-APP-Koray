import type { TaskMap, TaskQueueItem, WorkerMessage } from './taskTypes'
import type { UtilityProcess } from 'electron'
import { app, utilityProcess } from 'electron'
import path from 'node:path'
import { appCliStartArgs, isDev } from '/@/constants/common'

let inspectPort = 9230
let workerNo = 1

export class FileOperations {
  private workers = new Set<UtilityProcess>()
  private availableWorkers = new Set<UtilityProcess>()
  private tasksQueue: Map<number, TaskQueueItem<keyof TaskMap>> = new Map()
  private runningTasks: Map<number, TaskQueueItem<keyof TaskMap>> = new Map()
  private maxPoolSize: number
  private taskIdCounter = 1

  constructor(maxPoolSize: number) {
    // 这里使用动态 import 模块，是为了利用 vite 打包时的代码分割特性
    import('./fileWorker')
    this.maxPoolSize = maxPoolSize
  }

  /**  创建 worker */
  private createWorker(): UtilityProcess {
    // 加 inspect 9230
    const worker = utilityProcess.fork(path.join(import.meta.dirname, './fileWorker.mjs'), [], {
      execArgv: appCliStartArgs['roxy-log-level'] === 'debug' || isDev ? [`--inspect=${inspectPort++}`] : [],
      serviceName: `roxyFileWorker${workerNo++}`,
    })
    console.log('worker created', worker.pid)
    const handleMessage = (message: WorkerMessage) => {
      this.handleWorkerResponse(worker, message)
    }

    worker.on('message', handleMessage)
    worker.on('exit', () => {
      console.log('worker exit')
      this.removeWorker(worker)
    })

    this.workers.add(worker)
    return worker
  }

  /**  处理 worker 的响应 */
  private handleWorkerResponse<K extends keyof TaskMap>(
    worker: UtilityProcess,
    message: WorkerMessage<ReturnType<TaskMap[K]>>,
  ) {
    console.log('handleWorkerResponse', message)
    const taskId = message.taskId
    if (!taskId)
      return

    const task = this.runningTasks.get(taskId)
    if (!task)
      return

    this.runningTasks.delete(taskId)

    if (message.status === 'success') {
      task.resolve(message.data as ReturnType<TaskMap[K]>)
    }
    else {
      task.reject(new Error(message.error))
    }

    this.availableWorkers.add(worker)

    if (this.tasksQueue.size > 0) {
      this.processTaskQueue()
    }
  }

  /**  移除 worker */
  private removeWorker(worker: UtilityProcess) {
    this.workers.delete(worker)
    this.availableWorkers.delete(worker)

    for (const [taskId, task] of this.runningTasks.entries()) {
      if ((task as TaskQueueItem<keyof TaskMap> & { worker?: UtilityProcess }).worker === worker) {
        this.runningTasks.delete(taskId)
        task.reject(new Error('file operation worker exited unexpectedly'))
      }
    }
  }

  /**  处理任务队列 */
  private processTaskQueue() {
    if (this.tasksQueue.size === 0)
      return

    let worker: UtilityProcess | null = null

    if (this.availableWorkers.size > 0) {
      worker = Array.from(this.availableWorkers).shift()!
      this.availableWorkers.delete(worker)
    }
    else if (this.workers.size < this.maxPoolSize) {
      worker = this.createWorker()
    }

    if (worker) {
      const [taskId, task] = this.tasksQueue.entries().next().value!
      this.tasksQueue.delete(taskId)
      ;(task as TaskQueueItem<keyof TaskMap> & { worker?: UtilityProcess }).worker = worker
      this.runningTasks.set(taskId, task)
      worker.postMessage({ taskId, task: task.task, payload: task.payload })
    }
  }

  /**  执行任务 */
  async executeTask<K extends keyof TaskMap>(
    task: K,
    payload: Parameters<TaskMap[K]>[0],
    options?: { signal?: AbortSignal },
  ) {
    if (options?.signal?.aborted) {
      return Promise.reject(options.signal.reason ?? new Error('file operation aborted'))
    }

    const { promise, resolve, reject } = Promise.withResolvers<ReturnType<TaskMap[K]>>()
    const taskId = this.taskIdCounter++
    const handleAbort = () => {
      const abortError = options?.signal?.reason ?? new Error('file operation aborted')

      if (this.tasksQueue.has(taskId)) {
        this.tasksQueue.delete(taskId)
        reject(abortError)
        if (this.tasksQueue.size > 0) {
          this.processTaskQueue()
        }
        return
      }

      const runningTask = this.runningTasks.get(taskId) as (TaskQueueItem<keyof TaskMap> & { worker?: UtilityProcess }) | undefined
      if (!runningTask) {
        return
      }

      this.runningTasks.delete(taskId)
      runningTask.worker?.kill()
      reject(abortError)

      if (this.tasksQueue.size > 0) {
        this.processTaskQueue()
      }
    }

    const cleanupAbortListener = () => {
      options?.signal?.removeEventListener('abort', handleAbort)
    }

    this.tasksQueue.set(taskId, {
      taskId,
      task,
      payload,
      resolve: (value) => {
        cleanupAbortListener()
        resolve(value)
      },
      reject: (reason) => {
        cleanupAbortListener()
        reject(reason)
      },
    } as any)
    options?.signal?.addEventListener('abort', handleAbort, { once: true })
    await app.whenReady()

    if (options?.signal?.aborted) {
      handleAbort()
      return promise
    }

    this.processTaskQueue()
    return promise
  }

  /**  终止所有 worker */
  terminate(): void {
    this.workers.forEach(worker => worker.kill())
    this.workers.clear()
    this.availableWorkers.clear()
    this.tasksQueue.clear()
  }
}
