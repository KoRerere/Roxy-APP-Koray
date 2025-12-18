import crypto from 'node:crypto'

// DES 参数
const algorithm = 'des-cbc'
/**
 * 必须 8 字节
 */
const key = Buffer.from('12345678')
/**
 * 必须 8 字节
 */
const iv = Buffer.from('87654321')

/**
 * 加密
 */
function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  cipher.setAutoPadding(true) // PKCS5/7
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return encrypted
}

/**
 * 解密
 */
function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  decipher.setAutoPadding(true)
  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// 测试
const text = 'hello world'
const enc = encrypt(text)
const dec = decrypt(enc)

console.log(enc)
console.log(dec)
