import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { genChromeFingerprintConfig } from './genChromeFingerprintConfig'
import { genFirefoxFingerprintConfig } from './genFirefoxFingerprintConfig'

export * from './util'

export async function genFingerprintConfig(winInfo: WindowItemType, proxyInfo: Record<string, any> = {}, userDataDir = '') {
  const isFirefox = winInfo.coreType === 'Firefox'
  if (isFirefox) {
    return genFirefoxFingerprintConfig(winInfo, proxyInfo, userDataDir)
  }
  return genChromeFingerprintConfig(winInfo, proxyInfo, userDataDir)
}
