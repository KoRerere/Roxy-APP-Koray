export interface MainMessageResult<T = null> {
  code: number
  data: T
  message: string
}

export interface BrowserProcessMessage {
  /** 窗口目录 ID */
  dirId: string
  /** 打开的进度 */
  percent: number
  /** 信息 */
  message: string
}

export interface MainMessage {
  /** 拉起内核过程中的信息 */
  'browser:launch-process-message': (payload: MainMessageResult<BrowserProcessMessage>) => void
}
