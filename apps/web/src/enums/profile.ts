export enum ProfileOpenStatus {
  opened = 1,
  closed = 0,
}

export enum ProfileModifyType {
  /** 代理选择 */
  ProxySelect = 'proxy_select',
  /** 代理添加 */
  ProxyAdd = 'proxy_add',
  /** 删除代理 */
  ProxyDelete = 'proxy_delete',
  /** 添加平台账号 */
  PlatformAdd = 'platform_add',
  /** 选择平台账号 */
  PlatformSelect = 'platform_select',
  /** 编辑平台账号 */
  PlatformEdit = 'platform_edit',
  /** 编辑cookie */
  CookieEdit = 'cookie_edit',
}
