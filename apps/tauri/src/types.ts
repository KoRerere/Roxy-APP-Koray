// 以消息 type 作为 key 的“映射表”类型（方便按 key 精确取单个消息结构）
export interface WebSocketMessageMap {
  'app:login-required': {
    type: 'app:login-required'
    dirId: string
  }
  'browser:launch-process-message': {
    type: 'browser:launch-process-message'
    dirId: string
    percent: number
    message: string
    warningMessages: string[]
  }
  'browser:is-opened': {
    type: 'browser:is-opened'
    dirId: string
    opened: boolean
  }
  'browser:open-window': {
    type: 'browser:open-window'
    dirId: string
    workspaceId: number
    success: boolean
    message: string
  }
  'browser:open-url': {
    type: 'browser:open-url'
    dirId: string
    url: string
  }
}

// 可辨识联合类型：写 `if (message.type === '...')` 时会自动收窄到对应结构
export type WebSocketMessage = WebSocketMessageMap[keyof WebSocketMessageMap]

export interface RoxyConfig {
  apiKey: string
  apiPort: number
  defaultBrowserDirId: string
  defaultBrowserWorkspaceId: number
  /**
   * 由启动参数注入的“当前启动目标”，优先级高于默认值
   */
  currentDirId?: string
  currentWorkspace?: number
  appWsPort: number
  appWsToken: string
}
