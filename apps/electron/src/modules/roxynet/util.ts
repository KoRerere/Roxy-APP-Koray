import axios from 'axios'
import { createCipheriv, createDecipheriv } from 'node:crypto'
import { browserManager } from '/@/modules/browser'
import { getRoxynetProcess } from '/@/modules/roxynet'
import { store } from '/@/modules/store'
import { getSystemProxy } from '/@/utils'
import { Buffer } from 'node:buffer'

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
  }
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
  console.log('setRoxynetProxy', payload)
  return axios.post(`http://127.0.0.1:${store.roxynetLocalHttpPort}/set_proxy`, payload)
}

/**
 * 5. 窗口关闭后，删除roxynet中的ip
 * GET /del_proxy?id=dirId
 */
export async function delRoxynetProxy(dirId: string) {
  // 如果浏览器已经关闭，直接删除roxynet中的代理
  if (getRoxynetProcess() && !browserManager.openedBrowserMap.has(dirId)) {
    return axios.get(`http://127.0.0.1:${store.roxynetLocalHttpPort}/del_proxy?id=${dirId}`).then(res => res.data).catch((e) => {
      // console.error('delRoxynetProxy error:', e)
    })
  }
}

/**
 * 6.  动态配置系统代理在roxynet进程已经启动的情况下，
 * 可以调用该接口来修改系统代理。一般在什么情况下调用？
 * 1. 调整v2兼容开关。
 * 2. 检测到新的系统代理
 */
export async function setSystemProxy() {
  const params = {
    addr: await getSystemProxy(true),
    protocal: 'http',
    v2: store.v2raySwitch,
  }
  console.log('roxynet set_sysproxy 修改系统代理', params)
  return axios.post(`http://127.0.0.1:${store.roxynetLocalHttpPort}/set_sysproxy`, params).then(res => res.data).catch((e) => {
    console.error('setSystemProxy error:', e)
    return Promise.reject(e)
  })
}
