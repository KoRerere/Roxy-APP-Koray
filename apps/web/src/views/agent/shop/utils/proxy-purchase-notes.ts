/** 代理 IP 购买注意事项条目 */
export interface ProxyPurchaseNote {
  text: string
  bolds: string[]
}

/** 返回代理 IP 购买/支付弹窗共用的注意事项列表 */
export function getProxyPurchaseNotes(): ProxyPurchaseNote[] {
  return [
    {
      text: $t('{bold0}：导出代理 IP 需完成实名认证', { bold0: '{bold0}' }),
      bolds: [$t('导出限制')],
    },
    {
      text: $t('{bold0}：同时支持 SOCKS5 / HTTP 协议', { bold0: '{bold0}' }),
      bolds: [$t('协议支持')],
    },
    {
      text: $t('{bold0}：专人专享，绝不与他人共享', { bold0: '{bold0}' }),
      bolds: [$t('独享保证')],
    },
    {
      text: $t('{bold0}：订阅期内使用无流量上限', { bold0: '{bold0}' }),
      bolds: [$t('不限流量')],
    },
    {
      text: $t('{bold0}：无法连接的代理 IP，支持免费更换或退款', { bold0: '{bold0}' }),
      bolds: [$t('无忧售后')],
    },
    {
      text: $t('{bold0}：代理 IP 的续费价格将等同于您购买时的价格', { bold0: '{bold0}' }),
      bolds: [$t('原价续费')],
    },
    {
      text: $t('{bold0}：到期后自动停用且无法找回，请及时续费', { bold0: '{bold0}' }),
      bolds: [$t('过期即停')],
    },
  ]
}

/** 返回电商设备购买/支付弹窗共用的注意事项列表 */
export function getDevicePurchaseNotes(): ProxyPurchaseNote[] {
  return [
    {
      text: $t('{bold0}：导出设备需完成实名认证', { bold0: '{bold0}' }),
      bolds: [$t('导出限制')],
    },
    {
      text: $t('{bold0}：同时支持 SOCKS5 / HTTP 协议', { bold0: '{bold0}' }),
      bolds: [$t('协议支持')],
    },
    {
      text: $t('{bold0}：专人专享，绝不与他人共享', { bold0: '{bold0}' }),
      bolds: [$t('独享保证')],
    },
    {
      text: $t('{bold0}：订阅期内使用无流量上限', { bold0: '{bold0}' }),
      bolds: [$t('不限流量')],
    },
    {
      text: $t('{bold0}：设备的续费价格将等同于您购买时的价格', { bold0: '{bold0}' }),
      bolds: [$t('原价续费')],
    },
    {
      text: $t('{bold0}：到期后自动停用且无法找回，请及时续费', { bold0: '{bold0}' }),
      bolds: [$t('过期即停')],
    },
  ]
}
