import type { UserGetUserConfigListData } from '@roxy/backend-api'
import type { ResourceUpdateMessage } from './mainMessage'
import type { ProxyDetectionResult } from '#roxybrowser/utils/proxyDetection'
import type { WindowItemType } from '#roxybrowser/modules/browser/browser-manager/types'

export interface RenderMessage {
  /** 批量启动窗口 */
  'browser:batchLaunch': (winItemList: WindowItemType[]) => any
  /** 批量重启窗口 */
  'browser:batchRelaunch': (winItemList: WindowItemType[]) => any
  /** 批量关闭窗口 */
  'browser:batchClose': (dirIds: string[]) => void
  /** 批量删除窗口 */
  'browser:batchRemove': (dirIds: string[]) => void
  /** 代理检测 */
  'proxy:detection': (winItemList: WindowItemType) => ProxyDetectionResult
  /** 保存用户信息 */
  'user:setUserInfo': (userInfo: any) => void
  /** 保存软件设置 */
  'app:saveSoftConfig': (config: UserGetUserConfigListData['data']) => void
  /** 选择文件夹 */
  'dialog:selectDir': () => Promise<string>
  /** 检测更新 */
  'app:checkUpdate': () => Promise<boolean>
  /** 安装并更新 */
  'app:install-update': (info: ResourceUpdateMessage) => any
}
