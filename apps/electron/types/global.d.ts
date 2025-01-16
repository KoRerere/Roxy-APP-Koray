import { ROXY_WINDOW_ID_KEY } from "/@/constants";

declare global {
  var $t: (id: string, values?: Record<string, any>) => string
  namespace Express {
    export interface Response {
      success: <T = any>(data?: T, message?: string) => void
      error: (message?: unknown, code?: number) => void
    }
  }
}

declare module 'electron' {
  interface BrowserWindow {
    /** 自定义窗口唯一标识 */
    [ROXY_WINDOW_ID_KEY]: string
  }
}
