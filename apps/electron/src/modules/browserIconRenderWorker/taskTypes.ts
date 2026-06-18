import type { WriteBrowserIconPayload } from './writeBrowserIcon'

export interface BrowserIconRenderWorkerRequest {
  taskId: number
  payload: WriteBrowserIconPayload
}

export interface BrowserIconRenderWorkerMessage {
  taskId: number
  status: 'success' | 'error'
  error?: string
}
