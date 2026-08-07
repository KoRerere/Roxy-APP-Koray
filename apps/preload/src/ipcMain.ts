import type { MessageObj } from './types/'
import type { IpcMainInvokeEvent } from 'electron'
import { BrowserWindow, ipcMain } from 'electron'
import { deepSerialize } from './utils/serialize'

// 导出序列化工具供外部使用
export { deepSerialize, serializeIPCArgs } from './utils/serialize'

export class IPCMain<
  MessageType extends MessageObj<MessageType>,
  BackgroundMessageType extends MessageObj<BackgroundMessageType>,
> {
  private channel: string
  private listeners: Partial<Record<keyof MessageType, any>> = {}

  constructor(channel: string = 'IPC-bridge') {
    this.channel = channel

    this.bindMessage()
  }

  on<T extends keyof MessageType>(
    name: T,
    fn: (event: IpcMainInvokeEvent, ...args: Parameters<MessageType[T]>) => ReturnType<MessageType[T]>,
  ): void {
    if (this.listeners[name])
      throw new Error(`[IPC] ${String(name)} message handler already exists`)
    this.listeners[name] = fn
  }

  off<T extends keyof MessageType>(action: T): void {
    if (this.listeners[action]) {
      delete this.listeners[action]
    }
  }

  async send<T extends keyof BackgroundMessageType>(
    name: T,
    ...payload: Parameters<BackgroundMessageType[T]>
  ): Promise<void> {
    // 获取所有打开的窗口
    const windows = BrowserWindow.getAllWindows()

    // 序列化 payload，确保可以安全传输
    const serializedPayload = deepSerialize(payload)

    // 向每个窗口发送消息
    windows.forEach((window) => {
      try {
        window.webContents.send(this.channel, {
          name,
          payload: serializedPayload,
        })
      }
      catch (error) {
        console.error(`[IPC] Failed to send message ${String(name)}:`, error)
      }
    })
  }

  private bindMessage() {
    ipcMain.handle(this.channel, this.handleReceivingMessage.bind(this))
  }

  private async handleReceivingMessage(
    event: IpcMainInvokeEvent,
    payload: { name: keyof MessageType, payload: any },
  ) {
    try {
      // console.log("handleReceivingMessage", payload);
      if (this.listeners[payload.name]) {
        const res = await this.listeners[payload.name](event, ...payload.payload)
        // 序列化返回结果，确保可以安全传输
        return deepSerialize({
          type: 'success',
          result: res,
        })
      }
      else {
        throw new Error(`[IPC] Unknown message ${String(payload.name)}`)
      }
    }
    catch (e: any) {
      // 序列化错误对象
      return deepSerialize({
        type: 'error',
        error: e,
      })
    }
  }
}
