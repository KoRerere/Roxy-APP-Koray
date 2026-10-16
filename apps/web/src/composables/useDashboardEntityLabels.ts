import type { ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 浏览器内嵌工作台文案：普通模式与电商模式术语差异 */
export interface DashboardEntityLabels {
  /** 窗口信息 / 账号信息 */
  entityInfoTitle: string
  /** 项目 / 分组 */
  projectLabel: string
  /** 测试代理 IP / 测试设备 */
  testProxy: string
  /** 查询代理 IP */
  lookupProxy: string
  /** 代理 IP 检测失败 / 设备检测失败 */
  proxyDetectFailed: string
  /** 新手引导：代理信息区 */
  tourProxyInfo: string
  /** 新手引导：备注与指纹区 */
  tourProfileInfo: string
}

/** 按 workspace 模式生成工作台文案 */
export function createDashboardEntityLabels(isEcommerce: boolean): DashboardEntityLabels {
  if (isEcommerce) {
    return {
      entityInfoTitle: $t('账号信息'),
      projectLabel: $t('分组'),
      testProxy: $t('测试设备'),
      lookupProxy: $t('设备查询'),
      proxyDetectFailed: $t('设备检测失败'),
      tourProxyInfo: $t('这里显示账号当前设备信息。'),
      tourProfileInfo: $t('这里显示账号备注和指纹等信息。'),
    }
  }

  return {
    entityInfoTitle: $t('窗口信息'),
    projectLabel: $t('项目'),
    testProxy: $t('测试代理 IP'),
    lookupProxy: $t('代理 IP 查询'),
    proxyDetectFailed: $t('代理 IP 检测失败'),
    tourProxyInfo: $t('这里显示窗口当前代理 IP 信息。'),
    tourProfileInfo: $t('这里显示窗口备注和指纹等信息。'),
  }
}

/** 组件内按当前 workspace 类型读取工作台文案 */
export function useDashboardEntityLabels(): ComputedRef<DashboardEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createDashboardEntityLabels(isEcommerce.value))
}
