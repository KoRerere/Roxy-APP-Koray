import { $t } from '/@/locales'

export enum ExtensionsStatus {
  none = 0,
  update = 1,
}

export enum ExtensionsInstallType {
  all = 0,
  partial = 1,
}

export enum ExtensionsInstallStatus {
  notInstalled = 0,
  installed = 1,
}

export enum ExtensionsSource {
  sys = 'sys',
  local = 'local',
  store = 'store',
}

export function extensionsSourceFormat(source: ExtensionsSource): string {
  const sourceMap = ({
    [ExtensionsSource.sys]: $t('扩展推荐'),
    [ExtensionsSource.local]: $t('本地上传'),
    [ExtensionsSource.store]: $t('Google 商店'),
  }) as const

  return sourceMap[source]
}
