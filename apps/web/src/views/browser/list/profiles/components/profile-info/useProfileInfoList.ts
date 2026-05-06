import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import { formatProxyTime, strConcat } from '/@/utils'
import { ProxyCheckStatus } from '/@/enums/proxy'

const OS_ICON: Record<string, string> = {
  windows: 'platforms/rx_os_windows',
  linux: 'platforms/rx_os_linux',
  macos: 'platforms/rx_os_macOS',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
}

const CHECK_STATUS = {
  [ProxyCheckStatus.success]: 'var(--colors-text-text-success)',
  [ProxyCheckStatus.failure]: 'var(--colors-text-text-error)',
}

export function useProfileInfoList(
  data: MaybeRef<Record<string, any>>,
  openMessage: MaybeRef<Record<string, any> | undefined>,
  filterKeys: MaybeRef<string[]>,
) {
  const hasProxy = computed(() => unref(data).proxyCategory !== 'noproxy')

  const isOpenBrowser = computed(() => {
    const row = unref(data)
    return unref(openMessage)?.[row.dirId]?.data?.percent === 100
  })

  function formatVersion(os: string, osVersion: string) {
    if (os.toLocaleLowerCase() === 'macos' || os.toLocaleLowerCase() === 'ios') {
      const versionBit = osVersion.split('.')
      return versionBit[0]
    } else {
      return osVersion
    }
  }

  const list = computed(() => {
    const row = unref(data)
    const keys = unref(filterKeys)
    const proxyClass = hasProxy.value ? '' : row.lastIp ? 'direct-info' : 'direct'
    const windowPlatformList = row.windowPlatformList || []
    return [
      {
        key: 'os',
        svg: OS_ICON[(row.os as string).toLocaleLowerCase()],
        tooltip: $t('系统: {os} {osVersion}\n内核: Chrome {coreVersion}', {
          os: row.os === 'IOS' ? 'iOS' : row.os,
          osVersion: formatVersion(row.os, row.osVersion),
          coreVersion: row.coreVersion,
        }),
      },
      {
        key: 'proxy',
        classes: proxyClass,
        svg: hasProxy.value ? `country-code/${row.lastCountry}` : row.lastIp ? 'base/rx_ic_route2' : 'base/rx_ic_plus',
        svgColor: 'var(--colors-icon-icon-tertiary)',
        data: {
          hasProxy: hasProxy.value,
          lastCountry: row.lastCountry || '--',
          lastCity: strConcat('/', row.lastCity) || '',
          lastIp: row.lastIp || '--',
          checkTime: row.checkTime ? formatProxyTime(row.checkTime) : '--',
          beforeCountry: row.beforeProxyInfo?.beforeCountry || '--',
          beforeCity: strConcat('/', row.beforeProxyInfo?.beforeCity) || '',
          beforeIp: row.beforeProxyInfo?.beforeIp || '--',
          beforeTime: row.beforeProxyInfo?.beforeTime ? formatProxyTime(row.beforeProxyInfo?.beforeTime) : '--',
        },
        checkedColor: row._checkRes && CHECK_STATUS[row._checkRes.checkStatus as keyof typeof CHECK_STATUS],
      },
      {
        key: 'account',
        svg: windowPlatformList[0] ? 'base/rx_ic_user_key' : 'base/rx_ic_plus',
        svgColor: windowPlatformList[0] ? 'var(--colors-icon-icon-tertiary)' : 'var(--colors-icon-icon-secondary)',
        showSub: windowPlatformList.length > 1,
        platformAccount: windowPlatformList[0],
        subPlatformAccount: windowPlatformList.length > 2 ? undefined : windowPlatformList[1],
        data: windowPlatformList,
      },
    ].filter(item => keys.includes(item.key))
  })

  return { hasProxy, isOpenBrowser, list }
}
