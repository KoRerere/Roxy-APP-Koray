import { createGatewayConfig } from '@roxy/shared'

console.debug(`VITE_GATEWAY_URL_LIST`, import.meta.env.VITE_GATEWAY_URL_LIST)
const gateConfUrls: string[] = JSON.parse(import.meta.env.VITE_GATEWAY_URL_LIST)

const defaultAppGateway = import.meta.env.DEV ? 'https://apitest.roxybrowser.co' : 'https://hz.gate.roxybrowser.cn'
const defaultApiGateway = import.meta.env.DEV ? 'https://apitest.roxybrowser.co' : 'https://hz.api.roxybrowser.cn'

const gatewayConfig = createGatewayConfig({
  gateConfUrls,
  defaultAppGateway,
  defaultApiGateway,
})

/** 通过 API 调用的接口采用此域名 */
export const getOpenAPIUrl = gatewayConfig.getOpenAPIUrl

/** 通过 APP 调用的接口采用此域名 */
export const getBaseUrl = gatewayConfig.getBaseUrl

/** 拉取网关配置 */
export const getGatewayConfig = gatewayConfig.getGatewayConfig

/** 真实 IP 变化后重新拉取网关配置 */
export const reGetGatewayConfigByCountryChange = gatewayConfig.reGetGatewayConfigByCountryChange
