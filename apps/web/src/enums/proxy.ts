export enum ProxyCheckStatus {
  /** 没有测试 */
  none = 0,
  /** 测试成功 */
  success = 1,
  /** 检测失败 */
  failure = 2,
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

export enum ProxyReplaceStatus {
  /** 未更换 */
  none = 0,
  /** 已更换 */
  replaced = 1,
}

export enum ProxyStockStatus {
  /** 正常 */
  Active = 'active',
  /** 缺货 */
  Inactive = 'inactive',
}

export enum ProxyAutoRenewalStatus {
  /** 未启用 */
  Disabled = 0,
  /** 启用 */
  Enabled = 1,
}

export enum ProxyDescType {
  /** 展示价格 */
  Price = 1,
  /** 展示 icon */
  Icons = 2,
  /** 展示折扣 */
  Discount = 3,
  /** 展示描述 */
  Desc = 4,
}

export enum BuyProxyListType {
  /** 全部代理 IP */
  List = 'list_use',
  /** 有效代理 IP */
  Available = 'available_list',
  /** 可用的代理 IP */
  Use = 'window_use',
}

export enum BuyEntryType {
  /** 正常购买 */
  Normal = 0,
  /** 购买并使用 */
  Immediate = 1,
}
