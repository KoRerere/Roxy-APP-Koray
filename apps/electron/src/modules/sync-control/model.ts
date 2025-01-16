export interface SyncControlDoLayoutPayload {
  type: 'grid' | 'stack' | 'custom'
  /** 水平间隔 */
  gap_horizontal?: number
  /** 垂直间隔 */
  gap_vertical?: number
  /** 每一行的窗口个数 */
  count_per_row?: number
}

export interface SyncControlSendTextPayload {
  mode: 'same' | 'diff' | 'random'
  data: string | Record<string, string> | { min: string, max: string }
}

export interface SyncControlAPIResponse {
  code: number
  msg: string
}

export type SyncControlSettings = typeof syncSettings

export const syncSettings = {
  /** 是否同步键盘 */
  enableSyncKeybord: true,
  // 是否同步鼠标点击
  enableSyncMouseClick: true,
  // 是否同步鼠标轨迹
  enableSyncMouseMove: true,
  // 是否同步鼠标滚动
  enableSyncMouseScroll: true,
  // 输入延迟最小值
  inputIntervalMinMs: 100,
  // 输入延迟最大值
  inputIntervalMaxMs: 300,
  // 点击延迟最小值
  clickIntervalMinMs: 100,
  // 点击延迟最大值
  clickIntervalMaxMs: 300,
  // 点击延迟模式：0 串行， 1 并行
  clickDelayMode: 0,
}
