export interface SyncControlDoLayoutPayload {
  type: 'grid' | 'stack' | 'custom'
  /** 显示器索引 */
  monitor_index?: number
  /** 水平间隔 */
  gap_horizontal?: number
  /** 垂直间隔 */
  gap_vertical?: number
  /** 每一行的窗口个数 */
  count_per_row?: number
  /** 窗口宽度 */
  w?: number
  /** 窗口高度 */
  h?: number
}

export interface SyncControlSendTextPayload {
  mode: 'same' | 'diff' | 'random'
  data: string | Record<string, string> | {
    min: string
    max: string
    /** 数据类型填 float , int  */
    data_type: string
    /** 数据类型为float的时候，小数点的位数 */
    decimal_place_count: number
  }
}

export interface SyncControlAPIResponse {
  code: number
  msg: string
}

export type SyncControlSettings = typeof defaultSyncSettings

/** 默认的同步设置 */
export const preferenceSettings = {
  /** 基础设置  */
  base: {
    /** 主控窗口颜色 */
    mainControlWindowColor: '#FCFF12A3',
    /** 是否同步键盘 */
    enableSyncKeybord: true,
    /** 是否同步鼠标点击 */
    enableSyncMouseClick: true,
    /** 是否同步鼠标轨迹 */
    enableSyncMouseMove: true,
    /** 是否同步鼠标滚动 */
    enableSyncMouseScroll: true,
  },
  /** 自定义布局 */
  customLayout: {
    /** 窗口宽度 */
    w: 0,
    /** 窗口高度 */
    h: 0,
    type: 'custom' as 'grid' | 'stack' | 'custom',
    /** 水平间隔 */
    gap_horizontal: 0,
    /** 垂直间隔 */
    gap_vertical: 0,
    /** 每一行的窗口个数 */
    count_per_row: 2,
  },
  /** 仿真输入 */
  simulate: {
    /** 输入延迟最小值 */
    inputIntervalMinMs: 100,
    /** 输入延迟最大值 */
    inputIntervalMaxMs: 300,
    /** 是否开启点击延迟 */
    enableClickDelay: false,
    /** 是否开启输入延迟 */
    enableInputDelay: false,
    /** 点击延迟最小值 */
    clickIntervalMinMs: 100,
    /** 点击延迟最大值 */
    clickIntervalMaxMs: 300,
    /** 延迟模式：0 串行， 1 并行 */
    clickDelayMode: 1,
  },
  /**
   * 快捷键设置
   * https://github.com/electron/electron/blob/main/docs/api/accelerator.md
   */
  shortcutKey: {
    windows: {
      /** 开始同步 */
      // startSync: 'Ctrl + Alt + S',
      /** 停止同步 */
      stopSync: 'Ctrl + Alt + D',
      /** 显示所有窗口 */
      showAllWindows: 'Ctrl + Alt + A',
      /** 窗口排列 - 宫格布局 */
      gridLayout: 'Ctrl + Alt + F3',
      /** 窗口排列 - 堆叠布局 */
      stackLayout: 'Ctrl + Alt + F4',
      /** 批量输入 */
      openBatchInputDialog: 'Ctrl + Alt + F5',
      // /** 延迟点击 开/关 */
      // toggleClickDelay: 'Ctrl + Alt + F9',
      // /** 延迟输入 开关 */
      // toggleInputDelay: 'Ctrl + Alt + F10',
      /** 相同文本输入 */
      // openSameTextDialog: 'Ctrl + Alt + G',
      // /** 随机数字输入 */
      // openRandomNumberDialog: 'Ctrl + Alt + F',
      /** 统一标签页 */
      unifiedTabs: 'Ctrl + Alt + X',
      /** 关闭其他标签页 */
      closeOtherTabs: 'Ctrl + Alt + B',
      /** 关闭当前标签页 */
      closeCurrentTab: 'Ctrl + Alt + C',
      /** 关闭空白标签页 */
      closeBlankTabs: 'Ctrl + Alt + N',
      /** 打开网址 */
      openSites: 'Ctrl + Alt + O',
      /** 显示同步窗口列表 */
      openSyncWindowList: 'Ctrl + Alt + L',
      /** 同步偏好设置 */
      openPreferenceSettings: 'Ctrl + Alt + P',
    },
    mac: {
      /** 开始同步 */
      startSync: 'Ctrl + Alt + S',
      /** 停止同步 */
      stopSync: 'Ctrl + Alt + D',
      /** 显示所有窗口 */
      showAllWindows: 'Ctrl + Alt + A',
      /** 窗口排列 - 宫格布局 */
      gridLayout: 'Ctrl + Alt + F3',
      /** 窗口排列 - 堆叠布局 */
      stackLayout: 'Ctrl + Alt + F4',
      /** 批量输入 */
      openBatchInputDialog: 'Ctrl + Alt + F5',
      // /** 延迟点击 开/关 */
      // toggleClickDelay: 'Ctrl + Alt + F9',
      // /** 延迟输入 开关 */
      // toggleInputDelay: 'Ctrl + Alt + F10',
      /** 相同文本输入 */
      // openSameTextDialog: 'Ctrl + Alt + G',
      // /** 随机数字输入 */
      // openRandomNumberDialog: 'Ctrl + Alt + F',
      /** 统一标签页 */
      unifiedTabs: 'Ctrl + Alt + X',
      /** 关闭其他标签页 */
      closeOtherTabs: 'Ctrl + Alt + B',
      /** 关闭当前标签页 */
      closeCurrentTab: 'Ctrl + Alt + C',
      /** 关闭空白标签页 */
      closeBlankTabs: 'Ctrl + Alt + N',
      /** 打开网址 */
      openSites: 'Ctrl + Alt + O',
      /** 显示同步窗口列表 */
      openSyncWindowList: 'Ctrl + Alt + L',
      /** 同步偏好设置 */
      openPreferenceSettings: 'Ctrl + Alt + P',
    },
  },
}

export type PreferenceSettings = typeof preferenceSettings

export const defaultSyncSettings = {
  ...preferenceSettings.base,
  ...preferenceSettings.simulate,
}
