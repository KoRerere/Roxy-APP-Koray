import { findPlatformOption } from './components/platform-select'
import type { PlatformAbbrOption } from '/@/views/browser/create/window-name'

/** 解析登录字段标签时用到的账号字段 */
export interface AccountLoginLabelSource {
  platformUrl?: string
  platformAbbr?: string
}

/**
 * 已选平台的缩写。
 * 账号自带缩写优先；否则按当前网址对齐平台库。都没有时返回空串。
 */
export function resolveAccountPlatformAbbr(item: AccountLoginLabelSource | undefined, catalog: PlatformAbbrOption[]): string {
  const direct = String(item?.platformAbbr ?? '').trim()
  if (direct) {
    return direct
  }
  const matched = findPlatformOption(item?.platformUrl, catalog) as PlatformAbbrOption | undefined
  return matched?.platformAbbr?.trim() ?? ''
}

/**
 * 登录账号、密码的字段标签。
 * 有缩写时带上平台缩写，否则用通用文案，避免未选平台时出现空白前缀。
 */
export function resolveAccountLoginLabels(item: AccountLoginLabelSource | undefined, catalog: PlatformAbbrOption[]) {
  const platform = resolveAccountPlatformAbbr(item, catalog)
  if (!platform) {
    return {
      account: $t('平台登录账号'),
      password: $t('平台登录密码'),
    }
  }
  return {
    account: $t('{platform} 登录账号', { platform }),
    password: $t('{platform} 登录密码', { platform }),
  }
}
