import { getOsConfig } from './utils/getOsConfig'
import { isDev } from '/@/utils'

/** 当前系统信息 (Web Polyfill) */
export const osConfig = getOsConfig()

export const CUSTOM_PROTOCOL = isDev ? 'roxybrowser-dev://' : 'roxybrowser://'
