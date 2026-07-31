import { store } from '/@/modules/store'

/** 当前空间是否为电商模式（workspaceType === 2） */
export function isEcommerceWorkspace() {
  return (store.workspaceType ?? 0) === 2
}

/** 浏览器启动 / 代理检测相关文案：普通模式用「代理 IP」，电商模式用「设备」 */
export interface ProxyEntityLabels {
  /** 启动进度：代理 IP 检测中 / 设备检测中 */
  detecting: string
  /** 检测失败短文案 */
  detectFailed: string
  /** 检测失败并提示检查配置 */
  detectFailedCheckConfig: string
  /** 已购代理无法连接 */
  cannotConnect: string
  /** buyProxyStatus 错误码对应文案 */
  openErrorByStatus: Record<1 | 2 | 3 | 4 | 5 | 6, string>
}

/**
 * 按当前空间业务模式生成代理/设备相关文案
 * 读 store.workspaceType，需在用户已切换空间后调用
 */
export function getProxyEntityLabels(): ProxyEntityLabels {
  if (isEcommerceWorkspace()) {
    return {
      detecting: $t('设备检测中'),
      detectFailed: $t('设备检测失败'),
      detectFailedCheckConfig: $t('设备检测失败，请检查相关配置。'),
      cannotConnect: $t('无法连接至设备，请检查您当前的网络环境并重试。'),
      openErrorByStatus: {
        1: $t('您购买的设备检测到错误。{link}', { link: '{link}' }),
        2: $t('您购买的设备检测结果与目标出口 IP 不符。{link}', { link: '{link}' }),
        3: $t('绑定的设备已过期，请在打开账号前更新设备信息'),
        4: $t('您当前账号的设备已退款，无法使用。请在打开账号之前更新设备信息。'),
        5: $t('您购买的设备正在退款中，无法使用。请在打开账号之前更新设备信息。'),
        6: $t('您购买的设备正在更换中，无法使用。请在打开账号之前更新设备信息。'),
      },
    }
  }

  return {
    detecting: $t('代理 IP 检测中'),
    detectFailed: $t('代理 IP 检测失败'),
    detectFailedCheckConfig: $t('代理 IP 检测失败，请检查相关配置。'),
    cannotConnect: $t('无法连接至代理 IP，请检查您当前的网络环境并重试。'),
    openErrorByStatus: {
      1: $t('您购买的代理 IP 检测到错误。{link}', { link: '{link}' }),
      2: $t('您购买的代理 IP 检测结果与目标出口 IP 不符。{link}', { link: '{link}' }),
      3: $t('您购买的代理 IP 已过期。请在打开窗口前更新代理 IP 信息'),
      4: $t('您当前窗口的代理 IP 已退款，无法使用。请在打开窗口之前更新代理 IP 信息。'),
      5: $t('您购买的代理 IP 正在退款中，无法使用。请在打开窗口之前更新代理 IP 信息。'),
      6: $t('您购买的代理 IP 正在更换中，无法使用。请在打开窗口之前更新代理 IP 信息。'),
    },
  }
}
