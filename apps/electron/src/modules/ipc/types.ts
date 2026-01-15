import type { MainMessage, MainMessageResult, RenderMessage } from '@roxy/electron-preload'
import type { IPCMain } from '@roxy/electron-preload/main'

export type IPCMainInstance = IPCMain<RenderMessage, MainMessage>

/** 成功的消息体 */
export function successDataWrapper<T>(data: T, message = 'success'): MainMessageResult<T> {
  return {
    code: 0,
    data,
    message,
  }
}

/** 错误的信息体 */
export function errorDataWrapper(message = 'error', data?: any, error?: any): MainMessageResult {
  if (error?.message === '') {
    error.message = message
  }
  return {
    code: 1,
    data,
    message,
    error,
  }
}
