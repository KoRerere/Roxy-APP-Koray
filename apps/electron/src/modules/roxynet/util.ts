import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv } from 'node:crypto'
import { browserManager } from '/@/modules/browser'
import { getRoxynetProcess } from '/@/modules/roxynet'
import { store } from '/@/modules/store'
import { getNetworkMode, isKernelCustomProxyConfigured } from '/@/modules/store/networkMode'
import { getSystemProxy, request } from '/@/utils'

const key = '098otIp!'

export function encryptByDESModeCBC(message: string) {
  const cipher = createCipheriv('des-cbc', Buffer.from(key), Buffer.from(key))
  let encrypted = cipher.update(message, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return encrypted
}

export function decryptByDESModeCBC(ciphertext: string) {
  const decipher = createDecipheriv('des-cbc', Buffer.from(key), Buffer.from(key))
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export interface SetRoxynetProxyPayload {
  [dirId: string]: {
    addr: string
    user_name: string
    password: string
    protocal: string
    v2ray_tunnel_enabled: boolean
  }
}

export interface RoxynetUpstreamProxy {
  addr: string
  protocal: string
  v2: boolean
  user_name?: string
  password?: string
}

function normalizeRoxynetUpstreamProtocol(protocol?: string): string {
  const normalized = protocol?.trim().toLowerCase() ?? 'socks5'
  if (normalized === 'socks5' || normalized === 'ssh') {
    return 'socks5'
  }
  return normalized
}

/** 按 networkMode 构建 roxynet 上游代理（system 走系统代理，custom 走用户配置） */
export async function buildRoxynetUpstreamProxy(): Promise<RoxynetUpstreamProxy> {
  const mode = getNetworkMode()
  if (mode === 'custom') {
    if (!isKernelCustomProxyConfigured()) {
      console.warn('networkMode is custom but upstream proxy is not configured')
      return { addr: '', protocal: 'http', v2: false, user_name: '', password: '' }
    }
    return {
      addr: `${store.proxyHost!.trim()}:${store.proxyPort}`,
      protocal: normalizeRoxynetUpstreamProtocol(store.proxyProtocol),
      v2: false,
      user_name: store.proxyUsername ?? '',
      password: store.proxyPassword ?? '',
    }
  }

  const systemProxy = await getSystemProxy(true)
  return {
    addr: systemProxy.addr,
    protocal: systemProxy.protocol,
    v2: store.v2raySwitch ?? false,
  }
}

function toRoxynetUpstreamPayload(upstream: RoxynetUpstreamProxy) {
  const params: Record<string, string | boolean> = {
    addr: upstream.addr,
    protocal: upstream.protocal,
    v2: upstream.v2,
  }
  if (getNetworkMode() === 'custom') {
    params.user_name = upstream.user_name ?? ''
    params.password = upstream.password ?? ''
  }
  return params
}

/**
 *
 * roxynet 的代理通过roxynet本地HTTP服务的接口设置:
 * POST /set_proxy
 * body为JSON格式数据
 * ```json
 * {
 *   "dirId":{
 *     "addr":"gate.rola-ip.co:1000",
 *     "user_name":"rolalm",
 *     "password":"rolalm",
 *     "protocal":"http"
 *   }
 * }
 * ```
 * 需要特殊处理的：当用户配置的代理为HTTPS时，传给浏览器的代理类型改成HTTP，传给roxynet的代理保持为HTTPS
 */
export async function setRoxynetProxy(payload: SetRoxynetProxyPayload) {
  return request.post(`http://127.0.0.1:${store.roxynetLocalHttpPort}/set_proxy`, payload)
}

/**
 * 5. 窗口关闭后，删除roxynet中的ip
 * GET /del_proxy?id=dirId
 */
export async function delRoxynetProxy(dirId: string) {
  // 如果浏览器已经关闭，直接删除roxynet中的代理
  if (getRoxynetProcess() && !browserManager.openedBrowserMap.has(dirId)) {
    return request.get(`http://127.0.0.1:${store.roxynetLocalHttpPort}/del_proxy?id=${dirId}`).then(res => res.data).catch((e) => {
      // console.error('delRoxynetProxy error:', e)
    })
  }
}

/**
 * 6.  动态配置系统代理在roxynet进程已经启动的情况下，
 * 可以调用该接口来修改系统代理。一般在什么情况下调用？
 * 1. 调整v2兼容开关。
 * 2. 检测到新的系统代理
 * 3. networkMode 为 custom 时更新用户自定义上游代理
 */
export async function setSystemProxy() {
  if (!getRoxynetProcess()) {
    return
  }
  const upstream = await buildRoxynetUpstreamProxy()
  const params = toRoxynetUpstreamPayload(upstream)
  console.log('roxynet set_sysproxy modifying upstream proxy', params)
  return request.post(`http://127.0.0.1:${store.roxynetLocalHttpPort}/set_sysproxy`, params).then(res => res.data).catch((e) => {
    console.error('setSystemProxy error:', e)
    return Promise.reject(e)
  })
}
