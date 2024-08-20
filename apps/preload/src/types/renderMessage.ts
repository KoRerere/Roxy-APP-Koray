export interface RenderMessage {
  /** 启动窗口 */
  'browser:launch': (winItem: Record<string, any>) => any
  /** 批量启动窗口 */
  'browser:batchLaunch': () => any
}
