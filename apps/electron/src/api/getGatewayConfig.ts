import { createGatewayConfig } from '@roxy/shared'
import { debounce } from 'es-toolkit'
import { coreManager } from '/@/modules/browser'
import { appUpdater } from '/@/modules/updater'

console.debug(`VITE_GATEWAY_URL_LIST`, import.meta.env.VITE_GATEWAY_URL_LIST)
const gateConfUrls: string[] = JSON.parse(import.meta.env.VITE_GATEWAY_URL_LIST)

const defaultAppGateway = import.meta.env.DEV ? 'https://apitest.roxybrowser.co' : 'https://hz.gate.roxybrowser.cn'
const defaultApiGateway = import.meta.env.DEV ? 'https://apitest.roxybrowser.co' : 'https://hz.api.roxybrowser.cn'

const gatewayConfig = createGatewayConfig({
  gateConfUrls,
  defaultAppGateway,
  defaultApiGateway,
  onCountryChanged: debounce(() => {
    appUpdater.init()
    coreManager.fetchAvailableCoreList()
  }, 3000),
})

/** 通过 API 调用的接口采用此域名 */
export const getOpenAPIUrl = gatewayConfig.getOpenAPIUrl

/** 通过 APP 调用的接口采用此域名 */
export const getBaseUrl = gatewayConfig.getBaseUrl

/** 拉取网关配置 */
export const getGatewayConfig = gatewayConfig.getGatewayConfig

/** 真实 IP 变化后重新拉取网关配置 */
export const reGetGatewayConfigByCountryChange = gatewayConfig.reGetGatewayConfigByCountryChange

// 24 小时拿一次
setInterval(() => {
  getGatewayConfig()
}, 1000 * 60 * 60 * 24)

// 方便调试
Reflect.defineProperty(globalThis, '$getBaseUrl', {
  get() {
    return gatewayConfig.getBaseUrl()
  },
})
