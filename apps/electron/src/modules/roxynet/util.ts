import axios from 'axios'
import CryptoJS from 'crypto-js'
import { browserManager } from '/@/modules/browser'
import { getRoxynetProcess } from '/@/modules/roxynet'
import { store } from '/@/modules/store'
import { getSystemProxy } from '/@/utils'

const key = '098otIp!'

export function encryptByDESModeCBC(message: string) {
  const keyHex = CryptoJS.enc.Utf8.parse(key)
  const ivHex = CryptoJS.enc.Utf8.parse(key)
  const encrypted = CryptoJS.DES.encrypt(message, keyHex, {
    iv: ivHex,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  return encrypted.ciphertext.toString(CryptoJS.enc.Base64)
}

export function decryptByDESModeCBC(ciphertext) {
  const keyHex = CryptoJS.enc.Utf8.parse(key)
  const ivHex = CryptoJS.enc.Utf8.parse(key)
  const decrypted = CryptoJS.DES.decrypt({
    ciphertext: CryptoJS.enc.Base64.parse(ciphertext),
  }, keyHex, {
    iv: ivHex,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  return decrypted.toString(CryptoJS.enc.Utf8)
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
      console.error('delRoxynetProxy error:', e)
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
  })
}
