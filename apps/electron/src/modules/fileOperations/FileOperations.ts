import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { TaskMap, TaskQueueItem, WorkerMessage } from './taskTypes'

export class FileOperations {
  private workers = new Set<Worker>()
  private availableWorkers = new Set<Worker>()
  private tasksQueue: Map<number, TaskQueueItem<keyof TaskMap>> = new Map()
  private maxPoolSize: number
  private taskIdCounter = 1

  constructor(maxPoolSize: number) {
    // 这里使用动态 import 模块，是为了利用 vite 打包时的代码分割特性
    import('./fileWorker')
    this.maxPoolSize = maxPoolSize
  }

  /**  创建 worker */
  private createWorker(): Worker {
    const worker = new Worker(path.join(__dirname, './fileWorker.cjs'))

    const handleMessage = (message: WorkerMessage) => {
      this.handleWorkerResponse(worker, message)
    }

    worker.on('message', handleMessage)
    worker.on('exit', () => {
      this.removeWorker(worker)
    })

    this.workers.add(worker)
    return worker
  }

  /**  处理 worker 的响应 */
  private handleWorkerResponse<K extends keyof TaskMap>(
    worker: Worker,
    message: WorkerMessage<ReturnType<TaskMap[K]>>,
  ) {
    const taskId = message.taskId
    if (!taskId)
      return

    const task = this.tasksQueue.get(taskId)
    if (!task)
      return

    this.tasksQueue.delete(taskId)

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
  private removeWorker(worker: Worker) {
    this.workers.delete(worker)
    this.availableWorkers.delete(worker)
  }

  /**  处理任务队列 */
  private processTaskQueue() {
    if (this.tasksQueue.size === 0)
      return

    let worker: Worker | null = null

    if (this.availableWorkers.size > 0) {
      worker = Array.from(this.availableWorkers).shift()!
      this.availableWorkers.delete(worker)
    }
    else if (this.workers.size < this.maxPoolSize) {
      worker = this.createWorker()
    }

    if (worker) {
      const [taskId, task] = this.tasksQueue.entries().next().value!
      worker.postMessage({ taskId, task: task.task, payload: task.payload })
    }
  }

  /**  执行任务 */
  executeTask<K extends keyof TaskMap>(task: K, payload: Parameters<TaskMap[K]>[0]) {
    const { promise, resolve, reject } = Promise.withResolvers<ReturnType<TaskMap[K]>>()
    const taskId = this.taskIdCounter++
    this.tasksQueue.set(taskId, { taskId, task, payload, resolve, reject })
    this.processTaskQueue()
    return promise
  }

  /**  终止所有 worker */
  terminate(): void {
    this.workers.forEach(worker => worker.terminate())
    this.workers.clear()
    this.availableWorkers.clear()
    this.tasksQueue.clear()
  }
}
