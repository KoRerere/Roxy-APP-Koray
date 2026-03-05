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
      this.runningTasks.set(taskId, task)
      worker.postMessage({ taskId, task: task.task, payload: task.payload })
    }
  }

  /**  执行任务 */
  async executeTask<K extends keyof TaskMap>(task: K, payload: Parameters<TaskMap[K]>[0]) {
    const { promise, resolve, reject } = Promise.withResolvers<ReturnType<TaskMap[K]>>()
    const taskId = this.taskIdCounter++
    this.tasksQueue.set(taskId, { taskId, task, payload, resolve, reject } as any)
    await app.whenReady()
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
