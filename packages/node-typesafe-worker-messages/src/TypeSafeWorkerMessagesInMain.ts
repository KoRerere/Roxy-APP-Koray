import type { WorkerOptions } from 'node:worker_threads'
import { Worker } from 'node:worker_threads'
import type { LoggerType, MessageObj, MessageType } from './types'
import { UniqueId } from './types'

type ListenerFn<T extends MessageObj<T>, K extends keyof T> = (...args: Parameters<T[K]>) => ReturnType<T[K]>

type Listeners<T extends MessageObj<T>> = {
  [K in keyof T]: ListenerFn<T, K>
}

export class TypeSafeWorkerMessagesInMain<
  ParentMessage extends MessageObj<ParentMessage>,
  WorkerMessage extends MessageObj<WorkerMessage>,
> extends Worker {
  eventListeners: Partial<Listeners<WorkerMessage>> = {}
  callbackIncreaseId: number = 0
  callbackWaitingMap: Record<number, (...args: any[]) => any> = {}
  logger: LoggerType

  constructor(
    filename: string | URL,
    options?: WorkerOptions,
    logger?: LoggerType,
  ) {
    super(filename, options)
    this.logger = logger ?? console
    this._bindMessage()
  }

  send<T extends keyof ParentMessage>(
    name: T,
    ...payload: Parameters<ParentMessage[T]>
  ): Promise<Awaited<ReturnType<ParentMessage[T]>>> {
    const callbackID = this.callbackIncreaseId
    this.postMessage({
      from: UniqueId,
      type: 'message',
      name,
      payload,
      cbId: callbackID,
    })

    this.callbackIncreaseId++

    return new Promise((res) => {
      this.callbackWaitingMap[callbackID] = res
    })
  }

  handle<T extends keyof WorkerMessage>(
    name: T,
    fn: ListenerFn<WorkerMessage, T>,
  ): void {
    if (this.eventListeners[name])
      throw new Error(`Message handler ${String(name)} already existed!`)
    this.eventListeners[name] = fn
  }

  private _bindMessage() {
    this.on('message', this._handleReceivingMessage.bind(this))
  }

  private async _handleReceivingMessage(payload: MessageType) {
    if (!payload || !payload.from || payload.from !== UniqueId)
      return

    //  handle message
    if (payload.type === 'message') {
      if (this.eventListeners[payload.name]) {
        const res = await this.eventListeners[payload.name](...payload.payload)
        //  callback
        this.postMessage({
          from: UniqueId,
          type: 'callback',
          name: '',
          payload: res,
          cbId: payload.cbId,
        })
      }
      else {
        throw new Error(
          `Unknown message ${payload.name}, try to bind ${payload.name} as handle first.`,
        )
      }
      return
    }

    //  handle callback
    if (payload.type === 'callback') {
      if (this.callbackWaitingMap && this.callbackWaitingMap[payload.cbId]) {
        this.callbackWaitingMap[payload.cbId](payload.payload)
        delete this.callbackWaitingMap[payload.cbId]
      }
    }

    //  logger
    if (payload.type === 'logger') {
      this.logger[payload.name](...payload.payload)
    }
  }
}
