import type { MainMessage, RenderMessage } from '@roxy/electron-preload'
import { IPCMain } from '@roxy/electron-preload/main'

export const ipcMain = new IPCMain<RenderMessage, MainMessage>()

export * from './sender'
export * from './types'
