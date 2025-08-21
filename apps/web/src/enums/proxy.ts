export enum ProxyCheckStatus {
  none = 0, // 没有测试
  success = 1, // 测试成功
  failure = 2, // 检测失败
}

export enum ProxyProtocol {
  HTTP = 'HTTP',
  HTTPS = 'HTTPS',
  SOCKS5 = 'SOCKS5',
}

export enum ProxyType {
  /** 资源 */
  resource = 0,
  /** 购买 */
  buy = 1,
}

export enum ProxyOrderStatus {
  /** 配置中 */
  pending = 0,
  /** 已完成 */
  done = 1,
  /** 退款中 */
  refunding = 2,
  /** 更换中 */
  changing = 3,
  /** 已退款 */
  refunded = 4,
}

export enum ProxyExpireStatus {
  /** 已过期 */
  expired = 0,
  /** 使用中 */
  using = 1,
  /** 即将过期 */
  soon = 2,
}

export enum ProxyOrderType {
  /** 续费 */
  Renew = 'renew',
  /** 购买 */
  Purchase = 'purchase',
}

export enum ProxyReplaceType {
  /** 更换新代理 */
  Replace = 'replace',
  /** 退款 */
  Refund = 'refund',
}

export enum ProxyStockStatus {
  /** 正常 */
  Active = 'active',
  /** 缺货 */
  Inactive = 'inactive',
}
