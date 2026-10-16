/** 检测渠道字典项 */
export interface CheckChannelOption {
  label?: string
  value?: string
  /** 渠道名包含 ip123 时为真，下拉项展示官网入口 */
  external?: boolean
}

/**
 * 给 IP 检测渠道打上官网跳转标记。
 * 渠道名包含 ip123 时视为外部查询站。
 */
export function mapCheckChannelOptions<T extends CheckChannelOption>(options: T[] | null | undefined) {
  return (options ?? []).map(item => ({
    ...item,
    external: String(item.label ?? '').toLocaleLowerCase().includes('ip123'),
  }))
}
