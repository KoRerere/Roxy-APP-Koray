import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

// 固定密钥（32字节）
const secretKey = Buffer.from('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff', 'hex')
const nonce = crypto.randomBytes(12)

/** AES-GCM 加密函数 */
export function encryptAESGCM(msg) {
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, nonce)
  const ciphertext = Buffer.concat([cipher.update(msg), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [ciphertext, nonce, authTag].map(v => v.toString('base64')).join(':')
}

/** AES-GCM 解密函数 */
export function decryptAESGCM(str) {
  const [ciphertext, nonce, authTag] = str.split(':').map(v => Buffer.from(v, 'base64'))

  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, nonce)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  try {
    return JSON.parse(plaintext.toString('utf-8'))
  }
  catch (error) {
    return plaintext.toString('utf-8')
  }
}

// const str = encryptAESGCM(JSON.stringify({ key: 'value' })) ;
// console.log("Encrypted message:", str);
// const decryptedMsg = decryptAESGCM(str);
// const decryptedMsgJson = decryptedMsg.toString('utf-8');
// const decodedDict = JSON.parse(decryptedMsgJson);
// console.log("Decrypted message:", decodedDict);

// const str = `pdkRpjXekXy3kEqyaBddcI9gLmaWMM1Ny/X0aSIE5Ch76VQcI5eRZiTA0roN0lS3/484pqe+R+eY30oFvixEy+96ohRyn4Yh4jImNGTK/Kmm6Cxdhl3PvNclddd/d8HCZNbsi6gO/R3Dw5jzbJk9FS1QNPfDB+/smOB3OastlFiGtyl+egQA8HOg1OKzlj9xhS9JU2GGbYPf:t1Z8d+aMZK4q8Qyo:/RgRONczJnZrrvTStJlMNw==`

//   // 解密消息
//   const decryptedMsg = decryptAESGCM(str);
//   const decryptedMsgJson = decryptedMsg.toString('utf-8');
//   const decodedDict = JSON.parse(decryptedMsgJson);
//   console.log("Decrypted message:", decodedDict);
