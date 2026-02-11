// 固定密钥（32字节）- 与 Electron 端保持一致
const SECRET_KEY_HEX = btoa('ÓMuÛm÷ãyë®ûóÏ}i¦ÛqÇ]yçßÓMuÛm÷ãyë®ûóÏ}i¦ÛqÇ]yçß')

/**
 * 将 Hex 字符串转换为 Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * 将 Base64 字符串转换为 Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64)
  const len = binString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binString.charCodeAt(i)
  }
  return bytes
}

/**
 * 将 Uint8Array 转换为 Base64 字符串
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 导入密钥
 */
async function importKey(): Promise<CryptoKey> {
  const keyBytes = hexToBytes(SECRET_KEY_HEX)
  return window.crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * AES-GCM 加密函数
 * 返回格式: ciphertext:nonce:authTag (Base64编码)
 */
export async function encryptAESGCM(msg: string): Promise<string> {
  const key = await importKey()
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encodedMsg = new TextEncoder().encode(msg)

  // Web Crypto API 的 encrypt 结果包含 ciphertext + authTag (最后16字节)
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedMsg,
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)

  // 分离 ciphertext 和 authTag
  const authTagLength = 16
  const ciphertext = encryptedBytes.slice(0, -authTagLength)
  const authTag = encryptedBytes.slice(-authTagLength)

  return [
    bytesToBase64(ciphertext),
    bytesToBase64(iv),
    bytesToBase64(authTag),
  ].join(':')
}

/**
 * AES-GCM 解密函数
 */
export async function decryptAESGCM(str: string): Promise<any> {
  try {
    const parts = str.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format')
    }

    const [ciphertextB64, ivB64, authTagB64] = parts
    const ciphertext = base64ToBytes(ciphertextB64)
    const iv = base64ToBytes(ivB64)
    const authTag = base64ToBytes(authTagB64)

    const key = await importKey()

    // Web Crypto API decrypt 需要 ciphertext + authTag 拼接在一起
    const mergedBuffer = new Uint8Array(ciphertext.length + authTag.length)
    mergedBuffer.set(ciphertext)
    mergedBuffer.set(authTag, ciphertext.length)

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      mergedBuffer,
    )

    const decryptedString = new TextDecoder().decode(decryptedBuffer)

    try {
      return JSON.parse(decryptedString)
    }
    catch {
      return decryptedString
    }
  }
  catch (error) {
    console.error('Decryption failed:', error)
    // 保持与 Electron 版本一致的行为: 失败时返回原文或空?
    // Electron 版本 catch 后返回 plaintext.toString('utf-8')，但如果解密本身报错(authTag校验失败)，则是抛出异常
    // 这里如果解密失败，通常是 key 不对或数据被篡改，返回 null 或 抛出更合适，但为了兼容性：
    throw error
  }
}
