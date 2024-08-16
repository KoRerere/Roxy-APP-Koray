import { join } from 'node:path'
import { Worker } from 'node:worker_threads'

class BrowserWorkerManager {
  private _worker: Worker | null = null

  constructor() { }

  get worker(): Worker {
    console.log('worker', this._worker?.threadId)
    if (!this._worker) {
      this._worker = new Worker(join(__dirname, './browserWorker.cjs'))
    }
    return this._worker
  }

  postMessage(message: any) {
    this.worker.postMessage(message)
  }

  onMessage(callback: (message: any) => void) {
    this.worker.on('message', callback)
  }

  onError(callback: (error: Error) => void) {
    this.worker.on('error', callback)
  }

  onExit(callback: (exitCode: number) => void) {
    this.worker.on('exit', callback)
  }

  terminate() {
    this.worker.terminate()
    this._worker = null
  }
}

export const browserWorkerManager = new BrowserWorkerManager()
