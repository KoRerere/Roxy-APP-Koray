import { isNewerOrEqualVersion } from './common'

/** 当前客户端是否 ≥ v3.8.8（Firefox 内核、Skills 商城、MCP 积分等） */
export function supportsApp3_8_8() {
  return isNewerOrEqualVersion('3.8.8')
}
