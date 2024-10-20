import axios from 'axios'
import CryptoJS from 'crypto-js'
import { store } from '/@/modules/store'

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

export interface SetLuminetProxyPayload {
  [dirId: string]: {
    addr: string
    user_name: string
    password: string
    protocal: string
  }
}

/**
 *
 * luminet 的代理通过luminet本地HTTP服务的接口设置:
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
 * 需要特殊处理的：当用户配置的代理为HTTPS时，传给浏览器的代理类型改成HTTP，传给luminet的代理保持为HTTPS
 */
export async function setLuminetProxy(payload: SetLuminetProxyPayload) {
  console.log('setLuminetProxy', payload)
  return axios.post(`http://127.0.0.1:${store.luminetLocalHttpPort}/set_proxy`, payload)
}

/**
 * 5. 窗口关闭后，删除luminet中的ip
 * GET /del_proxy?id=dirId
 */
export async function delLuminetProxy(dirId: string) {
  return axios.get(`http://127.0.0.1:${store.luminetLocalHttpPort}/del_proxy?id=${dirId}`)
}
