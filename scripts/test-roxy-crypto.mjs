/**
 * 加解密互通回归测试
 * 用法: node scripts/test-roxy-crypto.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initSync, encrypt_aes_gcm, decrypt_aes_gcm, encrypt_aes_gcm_local, decrypt_aes_gcm_local } from '../packages/roxy-crypto/pkg/roxy_crypto_wasm.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, '../packages/roxy-crypto/pkg/roxy_crypto_wasm_bg.wasm')
initSync(readFileSync(wasmPath))

const samplePayload = JSON.stringify({ key: 'value', proxy: { host: '127.0.0.1' } })

// 1. 基本加解密
const encrypted = encrypt_aes_gcm(samplePayload)
const decrypted = decrypt_aes_gcm(encrypted)
if (decrypted !== samplePayload) {
  console.error('FAIL: basic encrypt/decrypt mismatch')
  process.exit(1)
}
console.log('PASS: basic encrypt/decrypt')

// 2. 格式验证 ciphertext:nonce:authTag
const parts = encrypted.split(':')
if (parts.length !== 3) {
  console.error('FAIL: invalid format')
  process.exit(1)
}
console.log('PASS: format ciphertext:nonce:authTag')

// 3. 本地 v2 加解密
const sessionMaterial = 'user@example.com'
const localEncrypted = encrypt_aes_gcm_local('my-password', sessionMaterial)
if (!localEncrypted.startsWith('v2:')) {
  console.error('FAIL: local encrypt missing v2 prefix')
  process.exit(1)
}
const localDecrypted = decrypt_aes_gcm_local(localEncrypted, sessionMaterial)
if (localDecrypted !== 'my-password') {
  console.error('FAIL: local decrypt mismatch')
  process.exit(1)
}
console.log('PASS: local v2 encrypt/decrypt')

// 4. v1 兼容（旧 remember-me 密文路径）
const v1Password = encrypt_aes_gcm('legacy-password')
const v1Decrypted = decrypt_aes_gcm(v1Password)
if (v1Decrypted !== 'legacy-password') {
  console.error('FAIL: v1 legacy decrypt')
  process.exit(1)
}
console.log('PASS: v1 legacy compatibility')

console.log('\nAll tests passed.')
