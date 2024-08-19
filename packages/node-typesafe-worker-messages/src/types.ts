import type { LogFunctions } from 'electron-log'

export const UniqueId = 'TSWM'

export type MessageObj<T> = {
  [K in keyof T]: (...args: any) => void;
}

export interface MessageType {
  from: typeof UniqueId
  type: 'message' | 'callback' | 'logger'
  name: string
  payload: any
  cbId: string
}

export type LoggerType = Pick<LogFunctions, 'error' | 'warn' | 'info' | 'log'>
