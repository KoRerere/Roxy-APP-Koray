import { isDev } from '/@/utils'

/** 应用自定义协议，用于唤起应用 */
export const appProtocolName = isDev ? 'roxybrowser-dev' : 'roxybrowser'
/** 自定义应用媒体协议，用于浏览本地资源文件 */
export const mediaProtocolName = 'roxy-media'
/** 自定义 API 请求协议 */
export const httpProtocolName = 'roxy-http'
