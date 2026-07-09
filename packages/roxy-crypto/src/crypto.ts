import { ensureCryptoReady } from './init'
import {
  decrypt_aes_gcm,
  decrypt_aes_gcm_local,
  encrypt_aes_gcm,
  encrypt_aes_gcm_local,
} from './roxy_crypto_wasm.js'

const LOCAL_PREFIX = 'v2:'

function parseDecrypted(plaintext: string): any {
  try {
    return JSON.parse(plaintext)
  }
  catch {
    return plaintext
  }
}

/** AES-GCM 加密（API 互通，固定密钥） */
export async function encryptAESGCM(msg: string): Promise<string> {
  await ensureCryptoReady()
  return encrypt_aes_gcm(msg)
}

/** AES-GCM 解密（API 互通，固定密钥） */
export async function decryptAESGCM(str: string): Promise<any> {
  await ensureCryptoReady()
  const plaintext = decrypt_aes_gcm(str)
  return parseDecrypted(plaintext)
}

/** 本地敏感数据加密（v2，密钥与 sessionMaterial 绑定） */
export async function encryptAESGCMLocal(msg: string, sessionMaterial: string): Promise<string> {
  await ensureCryptoReady()
  return encrypt_aes_gcm_local(msg, sessionMaterial)
}

/** 本地敏感数据解密（v2，兼容无前缀的旧 local 格式） */
export async function decryptAESGCMLocal(str: string, sessionMaterial: string): Promise<string> {
  await ensureCryptoReady()
  return decrypt_aes_gcm_local(str, sessionMaterial)
}

export function isLocalEncrypted(str: string): boolean {
  return str.startsWith(LOCAL_PREFIX)
}

/** 解密本地密码：依次尝试 v2 local → v1 API → 原文 */
export async function decryptLocalPassword(
  encrypted: string,
  sessionMaterial: string,
): Promise<string> {
  if (isLocalEncrypted(encrypted)) {
    return decryptAESGCMLocal(encrypted, sessionMaterial)
  }
  try {
    const result = await decryptAESGCM(encrypted)
    return typeof result === 'string' ? result : String(result)
  }
  catch {
    return encrypted
  }
}
