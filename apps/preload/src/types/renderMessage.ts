import type { ProxyDetectionResult } from '#roxybrowser/utils/proxyDetection'
import type { WindowItemType } from '#roxybrowser/modules/browser/browser-manager/types'

export interface RenderMessage {
  /** 批量启动窗口 */
  'browser:batchLaunch': (winItemList: WindowItemType[]) => any
  /** 批量关闭窗口 */
  'browser:batchClose': (dirIds: string) => any
  /** 批量删除窗口 */
  'browser:batchRemove': (dirIds: string[]) => any
  /** 代理检测 */
  'proxy:detection': (winItemList: WindowItemType) => ProxyDetectionResult
  /** 保存用户信息 */
  'user:setUserInfo': (userInfo: any) => any
}
